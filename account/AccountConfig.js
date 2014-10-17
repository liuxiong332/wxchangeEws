var Cu = Components.utils;
var Ci = Components.interfaces;

var EXPORTED_SYMBOLS = ['accountConfigConstructor'];
Cu.import('resource://accountConfig/SocketUtil.js');
Cu.import('resource://accountConfig/ServerVerifier.js');

var dbConfigFlags = {
  FLAG_NONE : 0x00,
  FLAG_SSL : 0x01,
  FLAG_TLS: 0x02
};

function AccountConfig(dbConfig) {
  this.incoming = this.createNewIncoming(dbConfig.recvInfo);
  this.outgoing = this.createNewOutgoing(dbConfig.sendInfo);
};

AccountConfig.prototype = {
  startIncomingVerify: function(successCallback, failCallback) {
    return ServerVerifier(this.incoming, successCallback, failCallback);
  },

  startOutgoingVerify: function(successCallback, failCallback) {
    return ServerVerifier(this.outgoing, successCallback, failCallback);
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
