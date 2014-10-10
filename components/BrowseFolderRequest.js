
var Cu = Components.utils;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import('resource://exchangeEws/Xml2jxonObj.js');
Cu.import("resource://exchangeEws/soapFunctions.js");
Cu.import('resource://exchangeEws/soapNSDef.js');
Cu.import('resource://exchangeEws/ExchangeRequest.js');
Cu.import('resource://exchangeEws/commonFunctions.js');
var browseLog = commonFunctions.Log.getInfoLevelLogger('BrowseFolderRequest');

var EXPORTED_SYMBOLS = ["BrowseFolderRequest"];

/*
 *the folderInfo can be the below list
 * serverUrl: ews url
 *	 folderID: the ID of folder
 *	 changeKey: a string that identifies a version of a folder, optional
 *	 folderBase: folders that can  be referenced by name,
 *	 		if the folderID isnot null, the folderBase is omit.
 *	 	mailbox: SMTP address, optional
 *	aCbOk: function(folders), folders is array of folderInfo
 *	aCbError: function(errCode, errMsg);
 */
function BrowseFolderRequest(folderInfo, aCbOk, aCbError) {
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;

	var self = this;
	this.exchangeRequest = new ExchangeRequest(folderInfo,
		this.onSendOk.bind(this),
		this.onSendError.bind(this));

	this.folderInfo = folderInfo;
	this.serverUrl = folderInfo.serverUrl;

	this.execute();
}

BrowseFolderRequest.prototype = {

	execute: function() {
		var req = new Xml2jxonObj('nsMessages:FindFolder');
		req.addNamespace('nsMessages', soapNSDef.nsMessagesStr);
		req.addNamespace('nsTypes', soapNSDef.nsTypesStr);
		req.setAttribute("Traversal", "Shallow");

		req.addChildTag("FolderShape", "nsMessages", null)
			.addChildTag("BaseShape", "nsTypes", "AllProperties");

		var parentFolder = makeParentFolderIds("ParentFolderIds", this.folderInfo);
		req.addChildTagObject(parentFolder);

   	this.exchangeRequest.sendRequest(makeSoapMessage(req), this.serverUrl);
	},

	onSendOk: function(request, xmlObj) {
		// Get FolderID and ChangeKey
		var childFolders = [];
		var folderInfo = this.folderInfo;

		var rm = xmlObj.XPath('/m:FindFolderResponse' +
			'/m:ResponseMessages/m:FindFolderResponseMessage' +
			'[@ResponseClass="Success" and m:ResponseCode="NoError"]');

		if(rm.length > 0)	{
			var rootFolder = rm[0].getChildTag("m:RootFolder");
			var includeAttr = 'IncludesLastItemInRange';
			if(rootFolder && rootFolder.getAttribute(includeAttr) === "true") {
			 	// Process results.
				var folders = rootFolder.XPath("/m:RootFolder/t:Folders/*") || [];
				folders.forEach(function(folder) {
					var folderIdTag = folder.getChildTag('t:FolderId');
					childFolders.push({
						folderBase: folderInfo.folderBase,
						folderID: 	folderIdTag.getAttribute("Id"),
						changeKey:  folderIdTag.getAttribute("ChangeKey"),
						foldername: folder.getChildTagValue("t:DisplayName", ""),
						totalCount: folder.getChildTagIntValue("t:TotalCount", 0),
						childFolderCount: folder.getChildTagIntValue("t:ChildFolderCount", 0),
						unreadCount: folder.getChildTagIntValue("t:UnreadCount", 0),
					});
				});
				this.mCbOk && this.mCbOk(this, childFolders);
				return;
			}
		}
		this.onSendError(request, 'NotFoundElement');
	},

	onSendError: function(aExchangeRequest, aCode, aMsg) {
		this.mCbError && this.mCbError(this, aCode, aMsg);
	},
};


