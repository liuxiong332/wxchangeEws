
Cc = Components.classes;
Ci = Components.interfaces;
Cu = Components.utils;
Cu.import('resource://exchangeEws/commonFunctions.js');
Cu.import('resource://exchangeEws/erBrowseFolder.js');
Cu.import('resource://exchangeEws/erFindMessages.js');
Cu.import('resource://exchangeEws/erGetMessage.js')

function ExchangeService() {
  this.userName = null;
  this.email = null;
  this.password = null;
  this.ewsUrl = null;
}

var EXPORTED_SYMBOLS = ['ExchangeService'];

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

  errHandler: function(request, code, msg) {
    var err = new Error(msg);
    err.code = code;
    callback(err);
  },
  /**
    folderName [string]: the parent folder name, such as inbox
    callback [function(err, childFolders)]
   */
  findFolders: function(folderName, callback) {
    var requestConfig = {
      serverUrl: this.ewsUrl,
      folderBase: folderName,
      user: this.userName,
      password: this.password
    };
    new erBrowseFolderRequest(requestConfig, function(request, childFolders) {
      callback(null, childFolders);
    }, this.errHandler);
  },

  findItemsByFolderId: function(folderId, itemCount, callback) {
    var requestConfig = {
      maxReturned: itemCount,
      serverUrl: this.ewsUrl,
      folderID: folderId,
      user: this.userName,
      password: this.password
    };
    new erFindMessagesRequest(requestConfig, function(request, messages) {
      callback(null, messages);
    }, this.errHandler);
  },
  getMessage: function(messageId, callback) {
    var requestConfig = {
      maxReturned: itemCount,
      serverUrl: this.ewsUrl,
      folderID: folderId,
      user: this.userName,
      password: this.password,
      messages: [messageId]
    };
    new erGetMessageRequest(requestConfig, function(request, messageDetails) {
      callback(null, messageDetails);
    }, this.errHandler);
  }
};


