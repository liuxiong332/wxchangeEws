var Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Cu.import("resource://exchangeEws/ExchangeRequest.js");
Cu.import("resource://exchangeEws/soapFunctions.js");
Cu.import('resource://exchangeEws/soapNSDef.js');
Cu.import('resource://exchangeEws/Xml2jxonObj.js');

var EXPORTED_SYMBOLS = ["FindMessagesRequest"];

/** requestInfo need property:
 *   	maxReturned: the max size of message item
 *		offset: the offset from the begining of the mailbox
 *	 	basePoint: Beginning(default) or End
 */
function FindMessagesRequest(requestInfo, aCbOk, aCbError) {
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;
	this.requestInfo = requestInfo;
	this.serverUrl = requestInfo.serverUrl;

	this.maxReturned = requestInfo.maxReturned;
	this.basePoint = requestInfo.basePoint === 'End' ? 'End' : 'Beginning';
	this.offset = requestInfo.offset || 0;

	this.exchangeRequest = new ExchangeRequest(requestInfo,
		this.onSendOk.bind(this), this.onSendError.bind(this));
	this.execute();
}

FindMessagesRequest.prototype = {
	execute: function() {
		var req = new Xml2jxonObj('nsMessages:FindItem');
		req.addNamespace('nsMessages', soapNSDef.nsMessagesStr);
		req.addNamespace('nsTypes', soapNSDef.nsTypesStr);
		req.setAttribute("Traversal", "Shallow");

		var itemShape = req.addChildTag("ItemShape", "nsMessages", null);
		itemShape.addChildTag("BaseShape", "nsTypes", "IdOnly");

		var additionalProperties =
			itemShape.addChildTag("AdditionalProperties", "nsTypes", null);
		additionalProperties.addChildTag("FieldURI", "nsTypes", null)
			.setAttribute("FieldURI", "item:Subject");

		var pageItemView = req.addChildTag('IndexedPageItemView', 'nsMessages', null);
		pageItemView.setAttribute('MaxEntriesReturned', this.maxReturned);
		pageItemView.setAttribute('BasePoint', this.basePoint);
		pageItemView.setAttribute('Offset', this.offset);

		// var sortOrder = req.addChildTag('SortOrder', 'nsMessages', null);
		// sortOrder.addChildTag('FieldOrder', )
		var parentFolder = makeParentFolderIds("ParentFolderIds", this.requestInfo);
		req.addChildTagObject(parentFolder);

    this.exchangeRequest.sendRequest(makeSoapMessage(req), this.serverUrl);
	},

	onSendOk: function(request, xmlObj) {
		var messages = [];

		var responseMsg = xmlObj.XPath('/m:FindItemResponse/m:ResponseMessages'+
			'/m:FindItemResponseMessage[m:ResponseCode="NoError"]');
		if(responseMsg.length > 0) {
			var rootFolders = responseMsg[0].XPath(
				'/m:FindItemResponseMessage/m:RootFolder');
			if(rootFolders.length > 0) {
				var rootFolder = rootFolders[0];
				var totalItemsInView = rootFolder.getAttribute("TotalItemsInView", 0);
				var includesLastItemInRange =
					rootFolder.getAttribute("IncludesLastItemInRange", "true");
				var msgObjs = rootFolder.XPath("/m:RootFolder/t:Items/t:Message");
				msgObjs.forEach(function(msg) {
					messages.push({
						itemId: 	msg.getAttributeByChildTag("t:ItemId", "Id"),
					  changeKey: msg.getAttributeByChildTag("t:ItemId", "ChangeKey"),
					  subject: msg.getChildTagValue("t:Subject")
					});
				});
				this.mCbOk && this.mCbOk(this, messages);
				return;
			}
		}
		this.onSendError(request, 'NotFoundElement');
	},

	onSendError: function(aExchangeRequest, aCode, aMsg) {
		this.mCbError && this.mCbError(this, aCode, aMsg);
	},
};


