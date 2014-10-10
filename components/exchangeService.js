
Cc = Components.classes;
Ci = Components.interfaces;
Cu = Components.utils;
Cu.import('resource://exchangeEws/commonFunctions.js');
Cu.import('resource://exchangeEws/BrowseFolderRequest.js');
Cu.import('resource://exchangeEws/FindMessagesRequest.js');
Cu.import('resource://exchangeEws/GetMessageRequest.js')

function ExchangeService() {
  this.userName = null;
  this.email = null;
  this.password = null;
  this.ewsUrl = null;
}

var EXPORTED_SYMBOLS = ['exchangeService'];

ExchangeService.prototype = {
  setCredential: function(email, password) {
    this.email = email;
    var regRes = /^([^@]+)/.exec(email);
    if(regRes)  throw new Error('email is invalid');
    this.userName = regRes[1];
    this.password = password;
  },

  setEwsUrl: function(url, callback) {
    this.ewsUrl = url;
    /*generate a find folder operation to validate the ews url*/
    findFolders('inbox', callback);
  },

  setAutodiscoverUrl: function(url, callback) {

  },
  /**
    folderName [string]: the parent folder name, such as inbox
    callback [function(err, childFolders)]
   */
  getChildFolders: function(folderName, callback) {
    var requestConfig = {
      serverUrl: this.ewsUrl,
      folderBase: folderName,
      user: this.userName,
      password: this.password
    };
    new BrowseFolderRequest(requestConfig, function (request, childFolders) {
      callback(null, childFolders);
    }, function (request, code, msg) {
      var err = new Error(msg);
      err.code = code;
      callback(err);
    });
  },

  _findMessages: function(config, callback) {
    new FindMessagesRequest(requestConfig, function (request, messages) {
      callback(null, messages);
    }, function (request, code, msg) {
      var err = new Error(msg);
      err.code = code;
      callback(err);
    });
  },

  findMessagesByFolderId: function(folderId, itemCount, callback) {
    var requestConfig = {
      maxReturned: itemCount,
      serverUrl: this.ewsUrl,
      folderID: folderId,
      user: this.userName,
      password: this.password
    };
    this._findMessages(requestConfig, callback);
  },

  findMessagesByFolderName: function(folderName, itemCount, callback) {
    var requestConfig = {
      maxReturned: itemCount,
      serverUrl: this.ewsUrl,
      folderID: folderId,
      user: this.userName,
      password: this.password
    };
    this._findMessages(requestConfig, callback);
  },

  getMessage: function(messageId, callback) {
    var requestConfig = {
      serverUrl: this.ewsUrl,
      user: this.userName,
      password: this.password,
      messages: [messageId]
    };
    function onOK(request, messages) {
      var msg = null;
      if(messages && messages.length > 0)
        msg = messages[0];
      callback(null, msg);
    }
    function onError(request, code, msg) {
      var err = new Error(msg);
      err.code = code;
      callback(err);
    }
    new GetMessageRequest(requestConfig, onOK, onError);
  }
};

var exchangeService = new ExchangeService;

