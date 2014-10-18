var Cu = Components.utils;
var Ci = Components.interfaces;
Cu.import('resource://accountConfig/SocketUtil.js');
Cu.import('resource://exchangeEws/commonFunctions.js');
var verifyLog = commonFunctions.Log.getInfoLevelLogger('ServerVerifier');

var EXPORTED_SYMBOLS = ['ServerVerifier', 'InOutServerVerifier'];

function ServerVerifier(config, successCallback, failCallback) {
  if(!(this instanceof ServerVerifier)) {
    var verifier = new ServerVerifier(config, successCallback, failCallback);
    return verifier.beginSocketVerify();
  }
  this.config = config;
  this.successCallback = successCallback;
  this.failCallback = failCallback;
}

ServerVerifier.OK = 0;
ServerVerifier.FAIL = 1;
ServerVerifier.RETRY = 2;

var TLS = 3;
ServerVerifier.prototype = {
  beginSocketVerify: function() {
    var CMDS = {
      'imap': ["1 CAPABILITY\r\n", "2 LOGOUT\r\n"],
      'pop3': ["CAPA\r\n", "QUIT\r\n"],
      'smtp': ["EHLO we-guess.mozilla.org\r\n", "QUIT\r\n"]
    };
    var config = this.config;
    var serverInfo = {
      hostname: config.hostname,
      ssl: config.ssl,
      port: config.port,
    };

    var self = this;
    function onOk(wiredata) {// result callback
      verifyLog.info('the result data is:' + wiredata);
      var res = self._processResult(wiredata);
      switch(res) {
        case ServerVerifier.OK:    self.successCallback(self); break;
        case ServerVerifier.FAIL:  onFail();   break;
      }
    }
    function onFail(e) {// error callback
      self.failCallback(this, e);
    }

    return SocketUtil(serverInfo, CMDS[config.type],
      new SSLErrorHandler(this), onOk, onFail);
  },

  _processResult : function(wiredata) {
    var config = this.config;
    if (this._gotCertError) {
      Cc["@mozilla.org/security/certoverride;1"]
        .getService(Ci.nsICertOverrideService)
        .clearValidityOverride(config.hostname, config.port);

      if (this._gotCertError == Ci.nsICertOverrideService.ERROR_MISMATCH) {
        return ServerVerifier.FAIL;
      }

      if (this._gotCertError == Ci.nsICertOverrideService.ERROR_UNTRUSTED ||
          this._gotCertError == Ci.nsICertOverrideService.ERROR_TIME) {
        this._gotCertError = false;
        config.selfSignedCert = true; // _next_ run gets this exception
        this.beginSocketVerify();
        return ServerVerifier.RETRY;
      }
    }
    verifyLog.info('the data is:' + !wiredata);
    if(!wiredata) {
      return ServerVerifier.FAIL;
    }
    config.authMethods = this._advertisesAuthMethods(config.type, wiredata);
    verifyLog.info('the auth methods is:' + config.authMethods);
    if (config.ssl == TLS && !this._hasTLS(wiredata)) {
      // this._log.info("STARTTLS wanted, but not offered");
      return ServerVerifier.FAIL;
    }
    // this._log.info("success with " + thisTry.hostname + ":" +
    //     thisTry.port + " " + protocolToString(thisTry.protocol) +
    //     " ssl " + thisTry.ssl +
    //     (thisTry.selfSignedCert ? " (selfSignedCert)" : ""));
    return ServerVerifier.OK;
  },

  /**
   * Which auth mechanism the server claims to support.
   * (That doesn't necessarily reflect reality, it is more an upper bound.)
   *
   * @param protocol {Integer-enum} IMAP, POP or SMTP
   * @param capaResponse {Array of {String}} on the wire data
   *     that the server returned. May be the full exchange or just capa.
   * @returns {Array of {Integer-enum} values for AccountConfig.incoming.auth
   *     (or outgoing), in decreasing order of preference.
   *     E.g. [ 5, 4 ] for a server that supports only Kerberos and
   *     encrypted passwords.
   */
  _advertisesAuthMethods : function(protocol, capaResponse) {
    // for imap, capabilities include e.g.:
    // "AUTH=CRAM-MD5", "AUTH=NTLM", "AUTH=GSSAPI", "AUTH=MSN"
    // for pop3, the auth mechanisms are returned in capa as the following:
    // "CRAM-MD5", "NTLM", "MSN", "GSSAPI"
    // For smtp, EHLO will return AUTH and then a list of the
    // mechanism(s) supported, e.g.,
    // AUTH LOGIN NTLM MSN CRAM-MD5 GSSAPI
    var result = new Array();
    var line = capaResponse.join("\n").toUpperCase();
    var prefix = "";
    if (protocol == 'pop3')
      prefix = "";
    else if (protocol == 'imap')
      prefix = "AUTH=";
    else if (protocol == 'smtp')
      prefix = "AUTH.*";
    else
      throw NotReached("must pass protocol");
    // add in decreasing order of preference
    if (new RegExp(prefix + "GSSAPI").test(line))
      result.push(Ci.nsMsgAuthMethod.GSSAPI);
    if (new RegExp(prefix + "CRAM-MD5").test(line))
      result.push(Ci.nsMsgAuthMethod.passwordEncrypted);
    if (new RegExp(prefix + "(NTLM|MSN)").test(line))
      result.push(Ci.nsMsgAuthMethod.NTLM);
    if (protocol != 'imap' || !line.contains("LOGINDISABLED"))
      result.push(Ci.nsMsgAuthMethod.passwordCleartext);
    return result;
  },

  _hasTLS : function(wiredata) {
    var config = this.config;
    var capa = config.type === 'pop3' ? "STLS" : "STARTTLS";
    return config.ssl == TLS && wiredata.join("").toUpperCase().contains(capa);
  },
};
/**
 * Called by MyBadCertHandler.js, which called by PSM
 * to tell us about SSL certificate errors.
 * @param thisTry {HostTry}
 */
function SSLErrorHandler(thisTry) {
  this._try = thisTry;
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

function InOutServerVerifier(config, successCallback, failCallback) {
  if(!(this instanceof InOutServerVerifier)) {
    var verifier =
      new InOutServerVerifier(config, successCallback, failCallback);
    return verifier.beginSocketVerify();
  }
  this.config = config;
  this.successCallback = successCallback;
  this.failCallback = failCallback;
}

InOutServerVerifier.prototype = {
  beginSocketVerify: function() {
    var self = this;
    var config = this.config;
    function onSuccess(verifier) {
      if(verifier.config === config.incoming) {
        self.inRes = true;
      } else {
        self.outRes = true;
      }
      if(self.inRes && self.outRes)
        self.successCallback(self);
    }

    function onFail(verifier, e) {
      if(!self.failed) {
        self.failCallback(self, e);
      }
      self.failed = true;
    }

    var inCancel = ServerVerifier(config.incoming, onSuccess, onFail);
    var outCancel = ServerVerifier(config.outgoing, onSuccess, onFail);
    return {
      cancel: function() {
        inCancel.cancel();
        outCancel.cancel();
      }
    };
  },
};
