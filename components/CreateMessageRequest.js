
var Cc = Components.classes;
var Cu = Components.utils;

Cu.import("resource://exchangeEws/soapFunctions.js");
Cu.import("resource://exchangeEws/ExchangeRequest.js");
Cu.import("resource://exchangeEws/soapNSDef.js");
Cu.import("resource://exchangeEws/Xml2jxonObj.js");

Cu.import('resource://exchangeEws/commonFunctions.js');

var createLog = commonFunctions.Log.getInfoLevelLogger('CreateMessageRequest');
var EXPORTED_SYMBOLS = ["CreateMessageRequest"];

/**
 * requestInfo need contain below elements:
 * 	ewsUrl: the url used for ews web service
 *	msgInfo: the information of message
 * 		subject
 *		body bodyType{Text|HTML}, content
 *  needSave: if the message need save in the specific folder
 *  saveFolderBase: name of folder the message will save if needed
 */
function CreateMessageRequest(requestInfo, aCbOk, aCbError) {
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;
	this.requestInfo = requestInfo;
	this.serverUrl = requestInfo.serverUrl;
	this.msgInfo = requestInfo.msgInfo;

	this.exchangeRequest = new SoapExchangeRequest(requestInfo,
		this.onSendOk.bind(this), this.onSendError.bind(this));

	this.execute();
}

CreateMessageRequest.prototype = {
	encodeMimeContent: function(content) {
		var hShellService = Cc["@mozilla.org/appshell/appShellService;1"].
			getService(Components.interfaces.nsIAppShellService);
		var HiddenWindow = hShellService.hiddenDOMWindow;

		createLog.info('begin tranform content');
		return HiddenWindow.btoa(encodeURIComponent(content));
	},

	execute: function() {
		var req = new Xml2jxonObj('nsMessages:CreateItem');
		req.addNamespace('nsMessages', soapNSDef.nsMessagesStr);
		req.addNamespace('nsTypes', soapNSDef.nsTypesStr);

		var requestInfo = this.requestInfo;
		var messageDisposition = 'SendOnly';
		if(requestInfo.needSave) {
			messageDisposition = 'SendAndSaveCopy';
		}
		req.setAttribute('MessageDisposition', messageDisposition);

		if(requestInfo.saveFolderBase) {
			var folderName = requestInfo.saveFolderBase;
			var saveFolder = new Xml2jxonObj('nsMessages:SavedItemFolderId');
			saveFolder.addChildTag('DistinguishedFolderId', 'nsTypes', null)
				.setAttribute('Id', folderName);
			req.addChildTagObject(saveFolder);
		}

		var messageTag = req.addChildTag('Items', 'nsMessages', null)
			.addChildTag('Message', 'nsTypes', null);
		var msgInfo = this.msgInfo;
		var content = msgInfo.mimeContent;
		messageTag.addChildTag('MimeContent', 'nsTypes',
			this.encodeMimeContent(content)).setAttribute('CharacterSet', 'UTF8');

		messageTag.addChildTag('ItemClass', 'nsTypes', 'IPM.Note');
		if(msgInfo.subject) {
			messageTag.addChildTag('Subject', 'nsTypes', msgInfo.subject);
		}
		if(msgInfo.body) {
			messageTag.addChildTag('Body', 'nsTypes', msgInfo.body.content)
				.setAttribute('BodyType', msgInfo.body.bodyType);
		}
		if(msgInfo.toRecipients) {
			var toRecipients = msgInfo.toRecipients;
			var mailbox = messageTag.addChildTag('ToRecipients', 'nsTypes', null)
				.addChildTag('Mailbox', 'nsTypes', null);
			if(toRecipients.emailAddress)
				mailbox.addChildTag('EmailAddress', 'nsTypes', toRecipients.emailAddress);
			// if(toRecipients.name)
			// 	mailbox.addChildTag('Name', 'nsTypes', toRecipients.name);
		}
		messageTag.addChildTag('IsRead', 'nsTypes', 'false');
		createLog.info(makeSoapMessage(req));
		this.exchangeRequest.sendRequest(makeSoapMessage(req), this.serverUrl);
	},

	onSendOk: function(request, xmlObj) {
		this.mCbOk && this.mCbOk(this);
	},

	onSendError: function(request, aCode, aMsg) {
		this.mCbError && this.mCbError(this, aCode, aMsg);
	},
};


