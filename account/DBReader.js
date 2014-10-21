
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

Cu.import("resource://accountConfig/accountConfig.js");
var EXPORTED_SYMBOLS = ['DBReader'];

function DBRowInfo(row) {
  this.domain = row.domain_;
  this.updateRecvInfo(row);
  this.updateSendInfo(row);
  this.num = row.num;
}

DBRowInfo.prototype = {
  translateProtocol: function(protocol) {
    return protocol === 'esa'?'exchange' : protocol;
  },

  updateRecvInfo: function(row) {
    var recvInfo = {};
    recvInfo.protocol = this.translateProtocol(row.recv_protocol);
    recvInfo.address = row.recv_address;
    recvInfo.username = row.recv_username;
    recvInfo.flags = row.recv_flags;
    recvInfo.port = row.recv_port;
    this.recvInfo = recvInfo;
  },

  updateSendInfo: function(row) {
    var sendInfo = {};
    sendInfo.protocol = this.translateProtocol(row.send_protocol);
    sendInfo.address = row.send_address;
    sendInfo.username = row.send_username;
    sendInfo.flags = row.send_flags;
    sendInfo.port = row.send_port;
    this.sendInfo = sendInfo;
    this.sendInfo = sendInfo;
  }
};



function DBReader(domain, configDbPath) {
  var resultConfig = [];
  var db = DBReader.openDB(DBReader.getDBFile(configDbPath));
  if(!db) return ;

  var sqStr = 'SELECT * FROM Email_providers WHERE domain_ = "' + domain + '"';
  var statement = mDBConn.createStatement(sqStr);
  while (statement.executeStep()) {
    var newDBRow = new DBRowInfo(statement.row);
    resultConfig.push(accountConfigConstructor(newDBRow));
  }
  statement.reset();
  return resultConfig;
}

DBReader.getDBFile = function(dbFileName) {
  var file = Cc["@mozilla.org/file/directory_service;1"]
    .getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
  file.append(dbFileName);
   if (!file.exists()) {
    throw "No KsEmailDb.File found!";
  }
  return file;
}

DBReader.openDB = function(file) {
  var storageService = Cc["@mozilla.org/storage/service;1"]
                        .getService(Ci.mozIStorageService);
  return storageService.openDatabase(file);
}
