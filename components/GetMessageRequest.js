
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

Cu.import("resource://exchangeEws/ExchangeRequest.js");
Cu.import("resource://exchangeEws/soapFunctions.js");
Cu.import('resource://exchangeEws/Xml2jxonObj.js');
Cu.import('resource://exchangeEws/soapNSDef.js');
Cu.import('resource://exchangeEws/commonFunctions.js');
var getLog = commonFunctions.Log.getInfoLevelLogger('GetMessageRequest');

var EXPORTED_SYMBOLS = ["GetMessageRequest"];


function GetMessageRequest(requestInfo, aCbOk, aCbError) {
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;
	this.requestInfo = requestInfo;
	this.messages = requestInfo.messages;
	this.serverUrl = requestInfo.serverUrl;

	this.exchangeRequest = new SoapExchangeRequest(requestInfo,
		this.onSendOk.bind(this), this.onSendError.bind(this));

	this.execute();
}

GetMessageRequest.prototype = {
	execute: function() {
		var req = new Xml2jxonObj('nsMessages:GetItem');
		req.addNamespace('nsMessages', soapNSDef.nsMessagesStr);
		req.addNamespace('nsTypes', soapNSDef.nsTypesStr);

		var itemShape = req.addChildTag("ItemShape", "nsMessages", null);
		itemShape.addChildTag("BaseShape", "nsTypes", "AllProperties");
		itemShape.addChildTag('IncludeMimeContent', 'nsTypes', 'true');

		var itemids = req.addChildTag("ItemIds", "nsMessages", null);
		this.messages.forEach(function(item) {
			var itemId = itemids.addChildTag("ItemId", "nsTypes", null);
			itemId.setAttribute("Id", item.itemId);
			if (item.ChangeKey) {
				itemId.setAttribute("ChangeKey", item.changeKey);
			}
		});
		this.exchangeRequest.sendRequest(makeSoapMessage(req), this.serverUrl);
	},

	getToRecipients: function(msg) {
		var mailboxs = msg.XPath('/t:Message/t:ToRecipients/t:Mailbox');
		if(!mailboxs || (mailboxs.length < 1))	return null;
		var mailbox = mailboxs[0];
		return {
			name: mailbox.getChildTagValue('t:Name', ''),
			emailAddress: mailbox.getChildTagValue('t:EmailAddress', '')
		};
	},

	getFrom: function(msg) {
		var mailboxs = msg.XPath('/t:Message/t:From/t:Mailbox');
		if(!mailboxs || (mailboxs.length < 1))	return null;
		var mailbox = mailboxs[0];
		return {
			name: mailbox.getChildTagValue('t:Name', ''),
			emailAddress: mailbox.getChildTagValue('t:EmailAddress', '')
		};
	},

	getBodyType: function(msg) {
		var bodyType = msg.getAttributeByChildTag('t:Body', 'BodyType', 'Text');
		var mimeType = 'text/plain';
		switch(bodyType) {
			case 'Text': 	mimeType = 'text/plain';	break;
			case 'HTML': 	mimeType = 'text/html'; 	break;
		}
		return mimeType;
	},

	getSentDateTime: function(msg) {
		var dateTime = msg.getChildTagValue('t:DateTimeSent');
		var dtReg = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/;
		var regRes = dtReg.exec(dateTime);
		if(regRes) {
			var milliSeconds =  Date.UTC(parseInt(regRes[1]), parseInt(regRes[2]) - 1,
				parseInt(regRes[3]), parseInt(regRes[4]), parseInt(regRes[5]),
				parseInt(regRes[6]));
			return new Date(milliSeconds);
		}
		return Date.now();
	},

	getMimeContent: function(msg) {
		var content = msg.getChildTagValue('t:MimeContent');
		var hShellService = Cc["@mozilla.org/appshell/appShellService;1"].
			getService(Components.interfaces.nsIAppShellService);

		var HiddenWindow = hShellService.hiddenDOMWindow;

		return HiddenWindow.atob(content);
	},

	onSendOk: function(request, xmlObj) {
		var self = this;
		var responseMsg = xmlObj.XPath('/m:GetItemResponse/m:ResponseMessages' +
			'/m:GetItemResponseMessage' +
			'[@ResponseClass="Success" and m:ResponseCode="NoError"]');
		if(responseMsg.length > 0) {
			var msgs = responseMsg[0].XPath('/m:GetItemResponseMessage/m:Items/*');
			var messages = [];
			msgs.forEach(function(msg) {
				var mimeContent = self.getMimeContent(msg);
				getLog.info(mimeContent);
				messages.push({
					itemId: 		msg.getChildTagValue('t:InternetMessageId'),
				  subject: 		msg.getChildTagValue("t:Subject"),
				  toRecipients: 	self.getToRecipients(msg),
				  from: 			self.getFrom(msg),
				  dateTimeSent: 	self.getSentDateTime(msg),
				  mimeContent: 		self.getMimeContent(msg)
				});
			});
			this.mCbOk && this.mCbOk(this, messages);
			return ;
		}
		this.onSendError(request, 'NotFoundElement');
	},

	onSendError: function(aExchangeRequest, aCode, aMsg) {
		this.mCbError && this.mCbError(this, aCode, aMsg);
	},
};


