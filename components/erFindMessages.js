/* ***** BEGIN LICENSE BLOCK *****
 * Version: GPL 3.0
 *
 * The contents of this file are subject to the General Public License
 * 3.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.gnu.org/licenses/gpl.html
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * -- Exchange 2007/2010 Contacts.
 * -- For Thunderbird.
 *
 * Author: Michel Verbraak (info@1st-setup.nl)
 * Website: http://www.1st-setup.nl/wordpress/?page_id=xx
 * email: exchangecontacts@extensions.1st-setup.nl
 *
 *
 * ***** BEGIN LICENSE BLOCK *****/
var Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Cu.import("resource://exchangeEws/ecExchangeRequest.js");
Cu.import("resource://exchangeEws/soapFunctions.js");
Cu.import("resource://exchangeEws/ecFunctions.js");

var EXPORTED_SYMBOLS = ["erFindMessagesRequest"];

function erFindMessagesRequest(aArgument, aCbOk, aCbError, aListener)
{
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;

	var self = this;

	this.parent = new ExchangeRequest(aArgument,
		function(aExchangeRequest, aResp) { self.onSendOk(aExchangeRequest, aResp);},
		function(aExchangeRequest, aCode, aMsg) { self.onSendError(aExchangeRequest, aCode, aMsg);},
		aListener);

	this.argument = aArgument;
	this.mailbox = aArgument.mailbox;
	this.serverUrl = aArgument.serverUrl;
	this.folderID = aArgument.folderID;
	this.folderBase = aArgument.folderBase;
	this.changeKey = aArgument.changeKey;
	this.listener = aListener;

	this.isRunning = true;
	this.execute();
}

erFindMessagesRequest.prototype = {

	execute: function _execute()
	{
//		exchWebService.commonFunctions.LOG("erFindContactsRequest.execute\n");

		var req = exchWebService.commonFunctions.xmlToJxon('<nsMessages:FindItem xmlns:nsMessages="'+nsMessagesStr+'" xmlns:nsTypes="'+nsTypesStr+'"/>');
		req.setAttribute("Traversal", "Shallow");

		var itemShape = req.addChildTag("ItemShape", "nsMessages", null);
		itemShape.addChildTag("BaseShape", "nsTypes", "IdOnly");

		var additionalProperties = itemShape.addChildTag("AdditionalProperties", "nsTypes", null);
		additionalProperties.addChildTag("FieldURI", "nsTypes", null).setAttribute("FieldURI", "item:Subject");

		var pageItemView = req.addChildTag('IndexedPageItemView', 'nsMessages', null);
		pageItemView.setAttribute('MaxEntriesReturned', this.argument.maxReturned);
		pageItemView.setAttribute('BasePoint', 'Beginning');
		pageItemView.setAttribute('Offset', '0');

		// var sortOrder = req.addChildTag('SortOrder', 'nsMessages', null);
		// sortOrder.addChildTag('FieldOrder', )

		var parentFolder = makeParentFolderIds2("ParentFolderIds", this.argument);
		req.addChildTagObject(parentFolder);
		parentFolder = null;

		this.parent.xml2jxon = true;

		//exchWebService.commonFunctions.LOG("erFindContactsRequest.execute:"+String(this.parent.makeSoapMessage(req)));

    this.parent.sendRequest(this.parent.makeSoapMessage(req), this.serverUrl);
		req = null;
	},

	onSendOk: function _onSendOk(aExchangeRequest, aResp)
	{
		exchWebService.commonFunctions.LOG("erFindContactsRequest.onSendOk:"+String(aResp));

		var rm = aResp.XPath("/s:Envelope/s:Body/m:FindItemResponse/m:ResponseMessages/m:FindItemResponseMessage/m:ResponseCode");

		if (rm.length == 0) {
			this.onSendError(aExchangeRequest, this.parent.ER_ERROR_RESPONS_NOT_VALID, "Respons does not contain expected field");
			return;
		}

		var responseCode = rm[0].value;

		if (responseCode == "NoError") {

			var messages = [];

			var rootFolder = aResp.XPath("/s:Envelope/s:Body/m:FindItemResponse/m:ResponseMessages/m:FindItemResponseMessage/m:RootFolder");
			if (rootFolder.length == 0) {
				this.onSendError(aExchangeRequest, this.parent.ER_ERROR_RESPONS_NOT_VALID, "Did not find a rootfolder element.");
				return;
			}

			// For now we do not do anything with the following two values.
			var totalItemsInView = rootFolder[0].getAttribute("TotalItemsInView", 0);
			var includesLastItemInRange = rootFolder[0].getAttribute("IncludesLastItemInRange", "true");

			for each (var msg in rootFolder[0].XPath("/t:Items/t:Message")) {
				messages.push({
						Id: msg.getAttributeByTag("t:ItemId", "Id"),
					  ChangeKey: msg.getAttributeByTag("t:ItemId", "ChangeKey"),
					  name: msg.getTagValue("t:Subject")
					});
			}


			if (this.mCbOk) {
				this.mCbOk(this, messages);
			}
			this.isRunning = false;
		}
		else {
			this.onSendError(aExchangeRequest, this.parent.ER_ERROR_SOAP_ERROR, responseCode);
		}
	},

	onSendError: function _onSendError(aExchangeRequest, aCode, aMsg)
	{
		this.isRunning = false;
		if (this.mCbError) {
			this.mCbError(this, aCode, aMsg);
		}
	},
};


