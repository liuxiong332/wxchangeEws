
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


function erGetMessageRequest(aArgument, aCbOk, aCbError, aListener)
{
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;

	var self = this;

	this.parent = new ExchangeRequest(aArgument,
		function(aExchangeRequest, aResp) { self.onSendOk(aExchangeRequest, aResp);},
		function(aExchangeRequest, aCode, aMsg) { self.onSendError(aExchangeRequest, aCode, aMsg);},
		aListener);
	this.argument = aArgument;
	this.serverUrl = aArgument.serverUrl;
	this.listener = aListener;
	this.messages = aArgument.messages;

	this.isRunning = true;
	this.requestedItemId = [];
	this.execute();
}

erGetMessageRequest.prototype = {

	execute: function _execute()
	{
		//exchWebService.commonFunctions.LOG("erGetTaskItemsRequest.execute\n");

		var root = xml2json.newJSON();
		xml2json.parseXML(root, '<nsMessages:GetItem xmlns:nsMessages="'+nsMessagesStr+'" xmlns:nsTypes="'+nsTypesStr+'"/>');
		var req = root[telements][0];

		var itemShape = xml2json.addTag(req, "ItemShape", "nsMessages", null);
		xml2json.addTag(itemShape, "BaseShape", "nsTypes", "Default");
		xml2json.addTag(itemShape, 'IncludeMimeContent', 'nsTypes', 'true');

		var itemids = xml2json.addTag(req, "ItemIds", "nsMessages", null);
		for each (var item in this.messages) {
			var itemId = xml2json.addTag(itemids, "ItemId", "nsTypes", null);
			xml2json.setAttribute(itemId, "Id", item.Id);
			this.requestedItemId.push(item.Id);
			if (item.ChangeKey) {
				xml2json.setAttribute(itemId, "ChangeKey", item.ChangeKey);
			}
			itemId = null;
		}
		itemids = null;

		this.parent.xml2json = true;
		//dump("erGetItemsRequest.execute:"+String(this.parent.makeSoapMessage2(req))+"\n");

		this.parent.sendRequest(this.parent.makeSoapMessage2(req), this.serverUrl);
		req = null;

		itemShape = null;
		additionalProperties = null;
	},

	onSendOk: function _onSendOk(aExchangeRequest, aResp)
	{
		//dump("erGetItemsRequest.onSendOk: "+xml2json.toString(aResp)+"\n");
		var rm = xml2json.XPath(aResp, "/s:Envelope/s:Body/m:GetItemResponse/m:ResponseMessages/m:GetItemResponseMessage[@ResponseClass='Success' and m:ResponseCode='NoError']/m:Items/*");

		exchWebService.commonFunctions.LOG('the get message response is ' + aResp);
		var rmErrorSearch = xml2json.XPath(aResp, "/s:Envelope/s:Body/m:GetItemResponse/m:ResponseMessages/m:GetItemResponseMessage");
		var rmErrors = [];
		if (rmErrorSearch.length > 0) {
			var i = 0;
			while (i < rmErrorSearch.length) {
				if (xml2json.getAttribute(rmErrorSearch[i], "ResponseClass", "") == "Error") {
					//dump("Found an get item with error answer. id:"+this.requestedItemId[i]+"\n");
					rmErrors.push(this.requestedItemId[i]);
				}
				i++;
			}
		}

		if (this.mCbOk) {
			this.mCbOk(this, rm, rmErrors);
		}

		this.isRunning = false;
		this.parent = null;
	},

	onSendError: function _onSendError(aExchangeRequest, aCode, aMsg)
	{
		//dump("erGetItemsRequest.onSendError: "+String(aMsg)+"\n");
		this.isRunning = false;
		this.parent = null;
		if (this.mCbError) {
			this.mCbError(this, aCode, aMsg);
		}
	},
};


