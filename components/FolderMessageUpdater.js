
var Cu = Components.utils;
var Ci = Components.interfaces;
var Cc = Components.classes;

Cu.import('resource://exchangeEws/ExchangeToRFC822Mail.js');
Cu.import('resource://exchangeEws/exchangeService.js');
Cu.import('resource://exchangeEws/commonFunctions.js');
var updateLog = commonFunctions.Log.getInfoLevelLogger('FolderMessageUpdater');

var EXPORTED_SYMBOLS = ["FolderMessageUpdater"];

function LineReader(str) {
	this.str = str;
	this.readLineReg = /(.*?)\r\n/g;
}

LineReader.prototype = {
	readLine: function() {
		var matchRes = this.readLineReg.exec(this.str);
		if(matchRes)	return matchRes[0];
		return null;
	}
}

function MsgWriter(folder) {
  this.folder = folder;
  this.converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
    .getService(Ci.nsIScriptableUnicodeConverter);
  this.converter.charset = 'UTF-8'
}
MsgWriter.prototype = {
  initNewHdr: function(newHdr, msgTransfer) {
    var converter = this.converter;
    newHdr.author = converter.ConvertFromUnicode(msgTransfer.getFrom());
    newHdr.subject = converter.ConvertFromUnicode(msgTransfer.getSubject());
    newHdr.recipients =
      converter.ConvertFromUnicode(msgTransfer.getToRecipients());
    newHdr.messageId = converter.ConvertFromUnicode(msgTransfer.getMsgId());
    newHdr.OrFlags(Ci.nsMsgMessageFlags.New);
  },

  convertToUTF8: function(str) {
    return this.converter.convertToByteArray(str, {});
  },

  getBinaryOutStream: function(outStream) {
    var binaryStream = Cc['@mozilla.org/binaryoutputstream;1']
      .createInstance(Ci.nsIBinaryOutputStream);
    binaryStream.setOutputStream(outStream);
    return binaryStream;
  },

  writeMsgToStream: function(msgMail, binaryStream) {
    var isBody = false;
    var byteSize = 0, bodyLines = 0;

    var lineStr = '';
    var lineReader = new LineReader(msgMail);
    while((lineStr = lineReader.readLine())) {
      if(isBody)  ++bodyLines;
      var byteArray = this.convertToUTF8(lineStr);
      byteSize += byteArray.length;
      binaryStream.writeByteArray(byteArray, byteArray.length);
      if(lineStr === '\r\n')  isBody = true;
    }
    return {
      byteSize: byteSize,
      bodyLines: bodyLines
    }
  },

  writeMsgIntoDatabase: function(message) {
    updateLog.info('get message:' + message.subject);
    var msgTransfer = new ExchangeToRFC822Mail(message);

    var msgStore = this.folder.msgStore;

    var newHdr = {};
    var outStream = msgStore.getNewMsgOutputStream(this.folder, newHdr, {});
    var binaryStream = this.getBinaryOutStream(outStream);
    newHdr = newHdr.value;//utf16
    this.initNewHdr(newHdr, msgTransfer);

    var byteInfo = this.writeMsgToStream(msgTransfer.getMsgMail(), binaryStream);
    newHdr.lineCount = byteInfo.bodyLines;
    newHdr.messageSize = byteInfo.byteSize;

    binaryStream.close();
    outStream.close();

    var msgDatabase = this.folder.msgDatabase;
    msgDatabase.AddNewHdrToDB(newHdr, true);
    msgDatabase.Commit(Ci.nsMsgDBCommitType.kLargeCommit);
  }
};

function FolderMessageUpdater(folder) {
	this.folder = folder;
	this.totalCount = 0;
	this.hasUpdateCount = 0;
  this.exchangeService = new ExchangeService;

}

FolderMessageUpdater.prototype = {
  _initExchangeService: function() {
    var server = this.folder.server;
    if(server) {
      updateLog.info('initialize the username:' + server.username +
        ',password:' + server.password + ',serverurl:' + server.ewsUrl);
      this.exchangeService.setCredential(server.username, server.password);
      this.exchangeService.setEwsUrl(server.ewsUrl);
    }
  },

  updateSummaryInfo: function(callback) {
    updateLog.info('begin update summary info');
    var self = this;
    this._initExchangeService();
    this.exchangeService.getFolder('inbox', function(err, folderInfo) {
      if(err) {
        updateLog.info('update failed:' + err.code);
        callback(err);
        return ;
      }
      self.totalCount = folderInfo.totalCount;
      updateLog.info('update totalCount:' + folderInfo.totalCount);
      callback();
    });
  },

  updateMsgList: function(msgs, msgCallback) {
    var self = this;
    var msgIndex = msgs.length - 1;
    updateLog.info('get the mesInfos, length is ' + msgs.length);
    function getNextMessage() {
      updateLog.info('prepare to update index ' + msgIndex);
      var msgInfos = [msgs[msgIndex]];
      self.exchangeService.getMessages(msgInfos, onGetMessage);
    }

    function onGetMessage(err, messages) {
      if(!err) {
        updateLog.info('update message:' + messages[0].subject);
        messages.forEach(msgCallback);
        self.hasUpdateCount += messages.length;
        msgIndex -= messages.length;
      }
      if(msgIndex < 0) {
        getNextMessage();
      } else if( self.hasUpdateCount < self.totalCount) {
        self.updateMessage();
      }
    }
    getNextMessage();
  },

  _updateMessage: function(msgCallback) {
    var self = this;
    this.exchangeService.findMessagesByFolderName('inbox', this.hasUpdateCount,
      100, function(err, msgs) {
      !err && self.updateMsgList(msgs, msgCallback);
    });
  },

  updateMessage: function() {
    updateLog.info('update messages');
    var writer = new MsgWriter(this.folder);
    this._updateMessage(function(message) {
      writer.writeMsgIntoDatabase(message);
    });
  }
}
