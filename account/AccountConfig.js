var Cu = Components.utils;
var Ci = Components.interfaces;

var EXPORTED_SYMBOLS = ['accountConfigConstructor'];
Cu.import('resource://accountConfig/SocketUtil.js');

var dbConfigFlags = {
  FLAG_NONE : 0x00,
  FLAG_SSL : 0x01,
  FLAG_TLS: 0x02
};

// SSL cert error handler

/**
 * Called by MyBadCertHandler.js, which called by PSM
 * to tell us about SSL certificate errors.
 * @param thisTry {HostTry}
 * @param logger {Log4Moz logger}
 */
function SSLErrorHandler(thisTry) {
  this._try = thisTry;
  this._gotCertError = false;
}
SSLErrorHandler.prototype = {
  processCertError : function(socketInfo, status, targetSite) {
    if (!status)
      return true;

    let cert = status.QueryInterface(Ci.nsISSLStatus).serverCert;
    let flags = 0;

    let parts = targetSite.split(":");
    let host = parts[0];
    let port = parts[1];

    /* The following 2 cert problems are unfortunately common:
     * 1) hostname mismatch:
     * user is custeromer at a domain hoster, he owns yourname.org,
     * and the IMAP server is imap.hoster.com (but also reachable as
     * imap.yourname.org), and has a cert for imap.hoster.com.
     * 2) self-signed:
     * a company has an internal IMAP server, and it's only for
     * 30 employees, and they didn't want to buy a cert, so
     * they use a self-signed cert.
     *
     * We would like the above to pass, somehow, with user confirmation.
     * The following case should *not* pass:
     *
     * 1) MITM
     * User has @gmail.com, and an attacker is between the user and
     * the Internet and runs a man-in-the-middle (MITM) attack.
     * Attacker controls DNS and sends imap.gmail.com to his own
     * imap.attacker.com. He has either a valid, CA-issued
     * cert for imap.attacker.com, or a self-signed cert.
     * Of course, attacker.com could also be legit-sounding gmailservers.com.
     *
     * What makes it dangerous is that we (!) propose the server to the user,
     * and he cannot judge whether imap.gmailservers.com is correct or not,
     * and he will likely approve it.
     */

    if (status.isDomainMismatch) {
      this._try._gotCertError = Ci.nsICertOverrideService.ERROR_MISMATCH;
      flags |= Ci.nsICertOverrideService.ERROR_MISMATCH;
    }
    else if (status.isUntrusted) {
      this._try._gotCertError = Ci.nsICertOverrideService.ERROR_UNTRUSTED;
      flags |= Ci.nsICertOverrideService.ERROR_UNTRUSTED;
    }
    else if (status.isNotValidAtThisTime) {
      this._try._gotCertError = Ci.nsICertOverrideService.ERROR_TIME;
      flags |= Ci.nsICertOverrideService.ERROR_TIME;
    }
    else {
      this._try._gotCertError = -1; // other
    }

    /* We will add a temporary cert exception here, so that
     * we can continue and connect and try.
     * But we will remove it again as soon as we close the
     * connection, in _processResult().
     * _gotCertError will serve as the marker that we
     * have to clear the override later.
     *
     * In verifyConfig(), before we send the password, we *must*
     * get another cert exception, this time with dialog to the user
     * so that he gets informed about this and can make a choice.
     */

    this._try.targetSite = targetSite;
    Cc["@mozilla.org/security/certoverride;1"]
      .getService(Ci.nsICertOverrideService)
      .rememberValidityOverride(host, port, cert, flags,true);
      // temporary override
    // this._log.warn("!! Overrode bad cert temporarily " + host + " " + port +
                   // "flags = " + flags + "\n");
    return true;
  },

  processSSLError : function(socketInfo, status, targetSite) {
    // this._log.error("got SSL error, please implement the handler!");
    // XXX record that there was an SSL error, and tell the user
    // about it somehow
    // XXX test case?
    // return true if you want to suppress the default PSM dialog
    return false;
  },
}


function AccountConfig(dbConfig) {
  this.incoming = this.createNewIncoming(dbConfig.recvInfo);
  this.outgoing = this.createNewOutgoing(dbConfig.sendInfo);
};

AccountConfig.prototype = {
  startVerify: function() {
    var CMDS = {
      'imap': ["1 CAPABILITY\r\n", "2 LOGOUT\r\n"],
      'pop3': ["CAPA\r\n", "QUIT\r\n"],
      'smtp': ["EHLO we-guess.mozilla.org\r\n", "QUIT\r\n"]
    };
    var incoming = this.incoming;
    var serverInfo = {
      hostname: incoming.hostname,
      ssl: incoming.ssl,
      port: incoming.port,
    };

    var sslRes = {};
    var abortable = SocketUtil(serverInfo,
          CMDS[incoming.type],
          new SSLErrorHandler(sslRes),
          function(wiredata) // result callback
          {
            if (me._cancel)
              return; // don't use response anymore
            me._processResult(thisTry, wiredata);
            me._checkFinished();
          },
          function(e) // error callback
          {
            if (me._cancel)
              return; // who set cancel to true already called mErrorCallback()
            me._log.warn(e);
            thisTry.status = kFailed;
            me._checkFinished();
          });
      thisTry.status = kOngoing;
  },
  getSocketType: function(configFlag) {
    // { enum: 1 = plain, 2 = SSL/TLS, 3 = STARTTLS always, 0 = not inited }
    if(configFlag & dbConfigFlags.FLAG_TLS) {
      return 3;
    } else if(configFlag & dbConfigFlags.FLAG_SSL) {
      return 2;
    } else if(configFlag === dbConfigFlags.FLAG_NONE) {
      return 1;
    }
    return 0;
  },
  createNewIncoming : function(recvInfo) {
    return {
      // { String-enum: "pop3", "imap", "nntp" }
      type : recvInfo.protocol,
      hostname : recvInfo.address,
      // { Integer }
      port : recvInfo.port,
             // May be a placeholder (st                 arts and ends with %). { String }
      username : recvInfo.username,
      password : null,
      // { enum: 1 = plain, 2 = SSL/TLS, 3 = STARTTLS always, 0 = not inited }
      // ('TLS when available' is insecure and not supported here)
      socketType : this.getSocketType(recvInfo.flags),
      /**
       * true when the cert is invalid (and thus SSL useless), because it's
       * 1) not from an accepted CA (including self-signed certs)
       * 2) for a different hostname or
       * 3) expired.
       * May go back to false when user explicitly accepted the cert.
       */
      badCert : false,
      /**
       * How to log in to the server: plaintext or encrypted pw, GSSAPI etc.
       * Defined by Ci.nsMsgAuthMethod
       * Same as server pref "authMethod".
       */
      auth : Ci.nsMsgAuthMethod.passwordCleartext,
      /**
       * Other auth methods that we think the server supports.
       * They are ordered by descreasing preference.
       * (|auth| itself is not included in |authAlternatives|)
       * {Array of Ci.nsMsgAuthMethod} (same as .auth)
       */
      authAlternatives : null,
      // in minutes { Integer }
      checkInterval : 10,
      loginAtStartup : true,
      // POP3 only:
      // Not yet implemented. { Boolean }
      useGlobalInbox : false,
      leaveMessagesOnServer : true,
      daysToLeaveMessagesOnServer : 14,
      deleteByAgeFromServer : true,
      // When user hits delete, delete from local store and from server
      deleteOnServerWhenLocalDelete : true,
      downloadOnBiff : true,
    };
  },
  createNewOutgoing : function(sendInfo) {
    return {
      type : "smtp",
      hostname : sendInfo.address,
      port : sendInfo.port, // see incoming
      username : sendInfo.username, // see incoming. may be null, if auth is 0.
      password : null, // see incoming. may be null, if auth is 0.
      socketType : this.getSocketType(sendInfo.flags), // see incoming
      badCert : false, // see incoming
      auth : Ci.nsMsgAuthMethod.passwordCleartext, // see incoming
      authAlternatives : null, // see incoming
      addThisServer : true, // if we already have an SMTP server, add this
      // if we already have an SMTP server, use it.
      useGlobalPreferredServer : false,
      // we should reuse an already configured SMTP server.
      // nsISmtpServer.key
      existingServerKey : null,
      // user display value for existingServerKey
      existingServerLabel : null,
    };
  },
};

function ExchangeConfig(dbConfig) {
  var recvInfo = dbConfig.recvInfo;
  this.domain = dbConfig.domain;
  this.server = recvInfo.address;
  this.username = recvInfo.username;
}

function accountConfigConstructor(dbConfig) {
  var config = null;
  if(dbConfig.recvInfo.protocol === 'exchange') {
    config = new ExchangeConfig(dbConfig);
  } else {
    config = new AccountConfig(dbConfig);
  }
  return config;
}
