
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

Cu.import("resource://exchangeEws/ExchangeRequest.js");
Cu.import("resource://exchangeEws/soapFunctions.js");
Cu.import('resource://exchangeEws/Xml2jxonObj.js');
Cu.import('resource://exchangeEws/soapNSDef.js');

var EXPORTED_SYMBOLS = ["GetMessageRequest"];


function GetMessageRequest(requestInfo, aCbOk, aCbError) {
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;
	this.requestInfo = requestInfo;
	this.messages = requestInfo.messages;
	this.serverUrl = requestInfo.serverUrl;

	this.exchangeRequest = new ExchangeRequest(requestInfo,
		this.onSendOk.bind(this), this.onSendError.bind(this));

	this.execute();
}

GetMessageRequest.prototype = {
	execute: function() {
		var req = new Xml2jxonObj('nsMessages:GetItem');
		req.addNamespace('nsMessages', soapNSDef.nsMessagesStr);
		req.addNamespace('nsTypes', soapNSDef.nsTypesStr);

		var itemShape = req.addChildTag("ItemShape", "nsMessages", null);
		itemShape.addChildTag("BaseShape", "nsTypes", "Default");
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

	onSendOk: function(request, xmlObj) {
		var self = this;
		var responseMsg = xmlObj.XPath('/m:GetItemResponse/m:ResponseMessages' +
			'/m:GetItemResponseMessage' +
			'[@ResponseClass="Success" and m:ResponseCode="NoError"]');
		if(responseMsg.length > 0) {
			var msgs = responseMsg[0].XPath('/m:GetItemResponseMessage/m:Items/*');
			var messages = [];
			msgs.forEach(function(msg) {
				var toRecipients =
				messages.push({
					itemId: 		msg.getAttributeByChildTag("t:ItemId", "Id"),
				  changeKey: 	msg.getAttributeByChildTag("t:ItemId", "ChangeKey"),
				  subject: 		msg.getChildTagValue("t:Subject"),
				  body: 			msg.getChildTagValue('t:Body'),
				  toRecipients: 	self.getToRecipients(msg),
				  from: 			self.getFrom(msg),
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


