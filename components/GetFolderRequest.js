
var Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Cu.import("resource://exchangeEws/ExchangeRequest.js");
Cu.import("resource://exchangeEws/soapFunctions.js");
Cu.import('resource://exchangeEws/Xml2jxonObj.js');
Cu.import('resource://exchangeEws/soapNSDef.js');

var EXPORTED_SYMBOLS = ["GetFolderRequest"];

function GetFolderRequest(folderInfo, aCbOk, aCbError) {
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;
	this.folderInfo = folderInfo;
	this.serverUrl = folderInfo.serverUrl;

	this.exchangeRequest = new ExchangeRequest(folderInfo,
		this.onSendOk.bind(this), this.onSendError.bind(this));
	this.execute();
}

GetFolderRequest.prototype = {
	execute: function() {
		var req = new Xml2jxonObj('nsMessages:GetFolder');
		req.addNamespace('nsMessages', soapNSDef.nsMessagesStr);
		req.addNamespace('nsTypes', soapNSDef.nsTypesStr);

		req.addChildTag("FolderShape", "nsMessages", null)
			.addChildTag("BaseShape", "nsTypes", "AllProperties");

		var parentFolder = makeParentFolderIds("FolderIds", this.folderInfo);
		req.addChildTagObject(parentFolder);

		this.exchangeRequest.sendRequest(makeSoapMessage(req), this.serverUrl);
	},

	onSendOk: function(request, xmlObj) {
		var folderInfo = this.folderInfo;

		var folderResMsgPath = '/m:GetFolderResponse/m:ResponseMessages' +
			'/m:GetFolderResponseMessage' +
			'[@ResponseClass="Success" and m:ResponseCode="NoError"]'
		var folderResMsgObjs = xmlObj.XPath(folderResMsgPath);
		var resFolder = null;
		if (folderResMsgObjs.length > 0) {
			var folderPath = '/m:GetFolderResponseMessage/m:Folders/t:Folder';
			var folderList = folderResMsgObjs[0].XPath(folderPath);
			if (folderList.length > 0) {
				var folder = folderList[0];
				var folderIdTag = folder.getChildTag('t:FolderId');
				resFolder = {
					folderBase: folderInfo.folderBase,
					folderID: 	folderIdTag.getAttribute("Id"),
					changeKey:  folderIdTag.getAttribute("ChangeKey"),
					foldername: folder.getChildTagValue("t:DisplayName", ""),
					totalCount: folder.getChildTagIntValue("t:TotalCount", 0),
					childFolderCount: folder.getChildTagIntValue("t:ChildFolderCount", 0),
					unreadCount: folder.getChildTagIntValue("t:UnreadCount", 0),
				};
				this.mCbOk && this.mCbOk(this, resFolder);
				return;
			}
		}
		this.onSendError(request, 'NotFound');
	},

	onSendError: function(aExchangeRequest, aCode, aMsg) {
		this.mCbError && this.mCbError(this, aCode, aMsg);
	},
};


