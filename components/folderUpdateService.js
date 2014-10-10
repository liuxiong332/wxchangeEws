
var Cu = Components.utils;
var Ci = Components.interfaces;
Cu.import('resource://exchangeEws/ExchangeToRFC822Mail.js');
Cu.import('resource://exchangeEws/exchangeService.js')

var EXPORTED_SYMBOLS = ["GetFolderRequest"];

function LineReader(str) {
	this.str = str;
	this.readLineReg = /(.*?)\r\n/g;
}

LineReader.prototype = {
	readLine: function() {
		var matchRes = readLineReg.exec(this.str);
		if(matchRes)	return matchRes[0];
		return null;
	}
}

function MsgWriter(folder) {
  this.folder = folder;
}
MsgWriter.prototype = {
  initNewHdr: function(newHdr, msgTransfer) {
    newHdr.author = msgTransfer.getFrom();
    newHdr.subject = msgTransfer.getSubject();
    newHdr.recipients = msgTransfer.getToRecipients();
    newHdr.messageId = msgTransfer.getMsgId();
    newHdr.OrFlags(Ci.nsMsgMessageFlags.New);
  },

  convertToUTF8: function(str) {
    var converter = QUnit.Cc['@mozilla.org/intl/scriptableunicodeconverter']
      .getService(QUnit.Ci.nsIScriptableUnicodeConverter);
    return converter.convertToByteArray(str, {});
  },

  getBinaryOutStream: function(outStream) {
    var binaryStream = QUnit.Cc['@mozilla.org/binaryoutputstream;1']
      .createInstance(QUnit.Ci.nsIBinaryOutputStream);
    binaryStream.setOutputStream(outStream);
    return binaryStream;
  },

  writeMsgToStream: function(msgMail, binaryStream) {
    var isBody = false;
    var byteSize = 0, bodyLines = 0;
    var lineReader = new LineReader(msgMail);
    while((var lineStr = lineReader.readLine())) {
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
    var msgTransfer = new ExchangeToRFC822Mail(message);

    var msgStore = this.folder.msgStore;

    var newHdr = {};
    var outStream = msgStore.getNewMsgOutputStream(inbox, newHdr, {});
    var binaryStream = this.getBinaryOutStream(outStream);
    newHdr = newHdr.value;
    this.initNewHdr(newHdr);

    var byteInfo = this.writeMsgToStream(msgTransfer.getMail(), outStream);
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
}

FolderMessageUpdater.prototype = {
  updateSummaryInfo: function() {
    var self = this;
    exchangeService.getFolder('inbox', function(err, folderInfo) {
      if(err) return;
      self.totalCount = folder.totalCount;
    });
  },

  updateMsgList: function(msgs) {
    var folder = this.folder;
    var self = this;
    msgs.forEach(function(msg) {
      exchangeService.getMessage(msg.itemId, function(err, message) {
        if(err) return ;
        new MsgWriter(folder).writeMsgIntoDatabase(message);
        ++ self.hasUpdateCount;
      });
    })
  },

  updateMessage: function() {
    var self = this;
    exchangeService.findMessagesByFolderName('inbox', 20, function(err, msgs) {
      !err && self.updateMsgList(msgs);
    })
  }
}
