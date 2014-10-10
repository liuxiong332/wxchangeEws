
var Cu = Components.utils;
var Ci = Components.interfaces;
Cu.import('resource://exchangeEws/ExchangeToRFC822Mail.js');

var EXPORTED_SYMBOLS = ["GetFolderRequest"];

function LineReader(str) {
	this.str = str;
	this.readLineReg = /(.*?)\r\n/g;
}

LineReader.prototype = {
	readLine: function() {

	}
}
function FolderMessageUpdater(folder) {
	this.folder = folder;
	this.totalCount = 0;
	this.hasUpdateCount = 0;
}

FolderMessageUpdater.prototype = {
	initNewHdr: function(newHdr, msgTransfer) {
		newHdr.author = msgTransfer.getFrom();
	  newHdr.subject = msgTransfer.getSubject();
	  newHdr.recipients = msgTransfer.getToRecipients();
	  newHdr.messageId = msgTransfer.getMsgId();
	  newHdr.OrFlags(Ci.nsMsgMessageFlags.New);
	},

	writeMsgIntoDatabase: function(message) {
		var msgTransfer = new ExchangeToRFC822Mail(message);

		var msgStore = this.folder.msgStore;

		var newHdr = {};
	  var outStream = msgStore.getNewMsgOutputStream(inbox, newHdr, {});
	  newHdr = newHdr.value;
	  this.initNewHdr(newHdr);
	}
}
