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
 * -- Exchange 2007/2010 Calendar and Tasks Provider.
 * -- For Thunderbird with the Lightning add-on.
 *
 * This work is a combination of the Storage calendar, part of the default Lightning add-on, and
 * the "Exchange Data Provider for Lightning" add-on currently, october 2011, maintained by Simon Schubert.
 * Primarily made because the "Exchange Data Provider for Lightning" add-on is a continuation
 * of old code and this one is build up from the ground. It still uses some parts from the
 * "Exchange Data Provider for Lightning" project.
 *
 * Author: Michel Verbraak (info@1st-setup.nl)
 * Website: http://www.1st-setup.nl/wordpress/?page_id=133
 * email: exchangecalendar@extensions.1st-setup.nl
 *
 *
 * This code uses parts of the Microsoft Exchange Calendar Provider code on which the
 * "Exchange Data Provider for Lightning" was based.
 * The Initial Developer of the Microsoft Exchange Calendar Provider Code is
 *   Andrea Bittau <a.bittau@cs.ucl.ac.uk>, University College London
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * ***** BEGIN LICENSE BLOCK *****/

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

Cu.import('resource://exchangeEws/soapNSDef.js');
Cu.import('resource://exchangeEws/Xml2jxonObj.js');

var EXPORTED_SYMBOLS = ["makeParentFolderIds" ];

const publicFoldersMap = { "publicfoldersroot" : true };

/* generate a xml string that contain the parentItem and the folderInfo
 * folderInfo is object, it can contain the property:
 *		folderID: the folder ID
 *		folderBase: the name of folder, such as inbox
 * 		mailbox: the smtp mmailbox address
 *		changeKey: the exchange version key
 */
function makeParentFolderIds(aParentItem, folderInfo)
{
	function xmlToJxon(aXMLString) {
		return new Xml2jxonObj(aXMLString);
	}

	var ParentFolderIds = xmlToJxon('<nsMessages:'+aParentItem+
		' xmlns:nsMessages="'+soapNSDef.nsMessagesStr+
		'" xmlns:nsTypes="'+ soapNSDef.nsTypesStr+'"/>');

	if (! folderInfo.folderID) {
		var DistinguishedFolderId = xmlToJxon(
			'<nsTypes:DistinguishedFolderId xmlns:nsTypes="'+
			soapNSDef.nsTypesStr+'"/>');
		DistinguishedFolderId.setAttribute("Id", folderInfo.folderBase);

		// If the folderBase is a public folder then do not provide mailbox if
		// available.
		if (! publicFoldersMap[folderInfo.folderBase]) {
			if (folderInfo.mailbox) {
				DistinguishedFolderId.addChildTag("Mailbox", "nsTypes", null)
					.addChildTag("EmailAddress", "nsTypes", folderInfo.mailbox);
			}
		}
		ParentFolderIds.addChildTagObject(DistinguishedFolderId);
		DistinguishedFolderId = null;
	}
	else {
		var FolderId = globalFunctions.xmlToJxon('<nsTypes:FolderId xmlns:nsTypes="'
			+ soapNSDef.nsTypesStr+'"/>');
		FolderId.setAttribute("Id", folderInfo.folderID);
		if ((folderInfo.changeKey) && (folderInfo.changeKey != "")) {
			FolderId.setAttribute("ChangeKey", folderInfo.changeKey);
		}

		ParentFolderIds.addChildTagObject(FolderId);
		FolderId = null;
	}

	return ParentFolderIds;
}

// This is the xml2json version.
// function makeParentFolderIds3(aParentItem, aArgument)
// {
// 	var root = xml2json.newJSON();
// 	var ParentFolderIds = xml2json.addTag(root, aParentItem, "nsMessages");
// 	xml2json.setAttribute(ParentFolderIds, "xmlns:nsMessages",
// 		soapNSDef.nsMessagesStr);
// 	xml2json.setAttribute(ParentFolderIds, "xmlns:nsTypes", soapNSDef.nsTypesStr);

// 	if (! aArgument.folderID) {
// 		let DistinguishedFolderId = xml2json.addTag(ParentFolderIds,
// 			"DistinguishedFolderId", "nsTypes", null);
// 		xml2json.setAttribute(DistinguishedFolderId, "Id", aArgument.folderBase);

// 		// If the folderBase is a public folder then do not provide mailbox if
// 		// available.
// 		if (! publicFoldersMap[aArgument.folderBase]) {
// 			if (aArgument.mailbox) {
// 				let mailbox = xml2json.addTag(DistinguishedFolderId, "Mailbox", "nsTypes", null);
// 				xml2json.addTag(mailbox, "EmailAddress", "nsTypes", aArgument.mailbox);
// 				mailbox = null;
// 			}
// 		}
// 		DistinguishedFolderId = null;
// 	}
// 	else {
// 		let FolderId = xml2json.addTag(ParentFolderIds, "FolderId", "nsTypes", null);
// 		xml2json.setAttribute(FolderId, "Id", aArgument.folderID);
// 		if ((aArgument.changeKey) && (aArgument.changeKey != "")) {
// 			xml2json.setAttribute(FolderId, "ChangeKey", aArgument.changeKey);
// 		}
// 		FolderId = null;
// 	}
// 	return ParentFolderIds;
// }

