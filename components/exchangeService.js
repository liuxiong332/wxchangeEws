
Cc = Components.classes;
Ci = Components.interfaces;
Cu = Components.utils;
Cu.import('resource://exchangeEws/commonFunctions.js');
Cu.import('resource://exchangeEws/BrowseFolderRequest.js');
Cu.import('resource://exchangeEws/GetFolderRequest.js');
Cu.import('resource://exchangeEws/FindMessagesRequest.js');
Cu.import('resource://exchangeEws/GetMessageRequest.js')

function ExchangeService() {
  this.userName = null;
  this.email = null;
  this.password = null;
  this.ewsUrl = null;
}

var EXPORTED_SYMBOLS = ['ExchangeService'];

ExchangeService.prototype = {
  setCredential: function(userName, password) {
    this.userName = userName;
    this.password = password;
  },

  setEwsUrl: function(url, callback) {
    this.ewsUrl = url;
    /*generate a find folder operation to validate the ews url*/
    callback && findFolders('inbox', callback);
  },

  setAutodiscoverUrl: function(url, callback) {

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
    new BrowseFolderRequest(requestConfig, function (request, childFolders) {
      callback(null, childFolders);
    }, function (request, code, msg) {
      var err = new Error(msg);
      err.code = code;
      callback(err);
    });
  },

  getFolder: function(folderName, callback) {
    var requestConfig = {
      serverUrl: this.ewsUrl,
      folderBase: folderName,
      user: this.userName,
      password: this.password
    };
    new GetFolderRequest(requestConfig, function (request, folder) {
      callback(null, folder);
    }, function (request, code, msg) {
      var err = new Error(msg);
      err.code = code;
      callback(err);
    });
  },

  _findMessages: function(config, callback) {
    new FindMessagesRequest(config, function (request, messages) {
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

  findMessagesByFolderName: function(folderName,offset, itemCount, callback) {
    var requestConfig = {
      basePoint: 'End',
      offset: offset,
      maxReturned: itemCount,
      serverUrl: this.ewsUrl,
      folderBase: folderName,
      user: this.userName,
      password: this.password
    };
    this._findMessages(requestConfig, callback);
  },

  getMessages: function(msgInfos, callback) {
    var requestConfig = {
      serverUrl: this.ewsUrl,
      user: this.userName,
      password: this.password,
      messages: msgInfos
    };
    function onOK(request, messages) {
      callback(null, messages);
    }
    function onError(request, code, msg) {
      var err = new Error(msg);
      err.code = code;
      callback(err);
    }
    new GetMessageRequest(requestConfig, onOK, onError);
  }
};

