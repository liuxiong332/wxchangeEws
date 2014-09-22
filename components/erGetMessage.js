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
 * Contributor: Krzysztof Nowicki (krissn@op.pl)
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

Cu.import("resource://exchangeEws/ecFunctions.js");
Cu.import("resource://exchangeEws/ecExchangeRequest.js");
Cu.import("resource://exchangeEws/soapFunctions.js");

Cu.import("resource://interfaces/xml2json/xml2json.js");

var EXPORTED_SYMBOLS = ["erGetMessageRequest"];


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
	this.ids = aArgument.ids;
	this.counter = 0;

	this.folderClass = aArgument.folderClass;

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
		xml2json.addTag(itemShape, "BaseShape", "nsTypes", "IdOnly");
//		xml2json.addTag(itemShape, "BodyType", "nsTypes", "Text");
		xml2json.addTag(itemShape, "BodyType", "nsTypes", "Best");

		var additionalProperties = xml2json.addTag(itemShape, "AdditionalProperties", "nsTypes", null);
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:ItemId'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:ParentFolderId'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:ItemClass'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:Attachments'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:Subject'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:DateTimeReceived'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:Size'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:Categories'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:HasAttachments'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:Importance'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:IsDraft'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:IsFromMe'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:IsResend'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:IsSubmitted'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:IsUnmodified'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:DateTimeSent'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:DateTimeCreated'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:Body'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:ResponseObjects'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:Sensitivity'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:ReminderDueBy'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:ReminderIsSet'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:ReminderMinutesBeforeStart'/>");
		xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:EffectiveRights'/>");
		//xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:MimeContent'/>");

		this.exchangeStatistics = Cc["@1st-setup.nl/exchange/statistics;1"]
				.getService(Ci.mivExchangeStatistics);

		if ((this.exchangeStatistics.getServerVersion(this.serverUrl).indexOf("Exchange2010") > -1) || (this.exchangeStatistics.getServerVersion(this.serverUrl).indexOf("Exchange2013") > -1 )) {
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='item:UniqueBody'/>");
		}
		else { // Exchange2007
		}

		var extFieldURI;
		extFieldURI = xml2json.addTag(additionalProperties, "ExtendedFieldURI", "nsTypes", null);
		xml2json.setAttribute(extFieldURI, "DistinguishedPropertySetId", "Common");
		xml2json.setAttribute(extFieldURI, "PropertyId", MAPI_PidLidReminderSignalTime);
		xml2json.setAttribute(extFieldURI, "PropertyType", "SystemTime");

		extFieldURI = xml2json.addTag(additionalProperties, "ExtendedFieldURI", "nsTypes", null);
		xml2json.setAttribute(extFieldURI, "DistinguishedPropertySetId", "Common");
		xml2json.setAttribute(extFieldURI, "PropertyId", MAPI_PidLidReminderSet);
		xml2json.setAttribute(extFieldURI, "PropertyType", "Boolean");

		extFieldURI = xml2json.addTag(additionalProperties, "ExtendedFieldURI", "nsTypes", null);
		xml2json.setAttribute(extFieldURI, "DistinguishedPropertySetId", "Common");
		xml2json.setAttribute(extFieldURI, "PropertyId", MAPI_PidLidReminderDelta);
		xml2json.setAttribute(extFieldURI, "PropertyType", "Integer");

			// Calendar fields
		switch (this.folderClass) {
		case "IPF.Appointment":
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:Start'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:End'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:OriginalStart'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:IsAllDayEvent'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:LegacyFreeBusyStatus'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:Location'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:When'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:IsMeeting'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:IsCancelled'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:IsRecurring'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:MeetingRequestWasSent'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:IsResponseRequested'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:CalendarItemType'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:MyResponseType'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:Organizer'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:RequiredAttendees'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:OptionalAttendees'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:Resources'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:Duration'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:TimeZone'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:Recurrence'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:ConferenceType'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:AllowNewTimeProposal'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:IsOnlineMeeting'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:MeetingWorkspaceUrl'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:UID'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:RecurrenceId'/>");

			if ((this.exchangeStatistics.getServerVersion(this.serverUrl).indexOf("Exchange2010") > -1) || (this.exchangeStatistics.getServerVersion(this.serverUrl).indexOf("Exchange2013") > -1 )) {
				xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:StartTimeZone'/>");
				xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:EndTimeZone'/>");
				xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:ModifiedOccurrences'/>");
				xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:DeletedOccurrences'/>");
				xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:FirstOccurrence'/>");
				xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:LastOccurrence'/>");
			}
			else { // Exchange2007
				xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='calendar:MeetingTimeZone'/>");
			}
			break;

		case "IPF.Task":
			//Task fields
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:ActualWork'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:AssignedTime'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:BillingInformation'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:ChangeCount'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:Companies'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:CompleteDate'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:Contacts'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:DelegationState'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:Delegator'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:DueDate'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:IsAssignmentEditable'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:IsComplete'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:IsRecurring'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:IsTeamTask'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:Mileage'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:Owner'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:PercentComplete'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:Recurrence'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:StartDate'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:Status'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:StatusDescription'/>");
			xml2json.parseXML(additionalProperties,"<nsTypes:FieldURI FieldURI='task:TotalWork'/>");

			extFieldURI = xml2json.addTag(additionalProperties, "ExtendedFieldURI", "nsTypes", null);
			xml2json.setAttribute(extFieldURI, "DistinguishedPropertySetId", "Task");
			xml2json.setAttribute(extFieldURI, "PropertyId", MAPI_PidLidTaskAccepted);
			xml2json.setAttribute(extFieldURI, "PropertyType", "Boolean");

			extFieldURI = xml2json.addTag(additionalProperties, "ExtendedFieldURI", "nsTypes", null);
			xml2json.setAttribute(extFieldURI, "DistinguishedPropertySetId", "Task");
			xml2json.setAttribute(extFieldURI, "PropertyId", MAPI_PidLidTaskLastUpdate);
			xml2json.setAttribute(extFieldURI, "PropertyType", "SystemTime");

			extFieldURI = xml2json.addTag(additionalProperties, "ExtendedFieldURI", "nsTypes", null);
			xml2json.setAttribute(extFieldURI, "DistinguishedPropertySetId", "Task");
			xml2json.setAttribute(extFieldURI, "PropertyId", MAPI_PidLidTaskAcceptanceState);
			xml2json.setAttribute(extFieldURI, "PropertyType", "Integer");

			extFieldURI = xml2json.addTag(additionalProperties, "ExtendedFieldURI", "nsTypes", null);
			xml2json.setAttribute(extFieldURI, "DistinguishedPropertySetId", "Task");
			xml2json.setAttribute(extFieldURI, "PropertyId", MAPI_PidLidTaskMode);
			xml2json.setAttribute(extFieldURI, "PropertyType", "Integer");

			extFieldURI = xml2json.addTag(additionalProperties, "ExtendedFieldURI", "nsTypes", null);
			xml2json.setAttribute(extFieldURI, "DistinguishedPropertySetId", "Task");
			xml2json.setAttribute(extFieldURI, "PropertyId", MAPI_PidLidTaskGlobalId);
			xml2json.setAttribute(extFieldURI, "PropertyType", "Binary");

			extFieldURI = xml2json.addTag(additionalProperties, "ExtendedFieldURI", "nsTypes", null);
			xml2json.setAttribute(extFieldURI, "DistinguishedPropertySetId", "Task");
			xml2json.setAttribute(extFieldURI, "PropertyId", MAPI_PidLidTaskHistory);
			xml2json.setAttribute(extFieldURI, "PropertyType", "Integer");

			extFieldURI = xml2json.addTag(additionalProperties, "ExtendedFieldURI", "nsTypes", null);
			xml2json.setAttribute(extFieldURI, "DistinguishedPropertySetId", "Task");
			xml2json.setAttribute(extFieldURI, "PropertyId", MAPI_PidLidTaskOwnership);
			xml2json.setAttribute(extFieldURI, "PropertyType", "Integer");
		}
/*
			//meeting fields
			req.nsMessages::ItemShape.nsTypes::AdditionalProperties.content += <>
				<nsTypes:FieldURI FieldURI="meeting:AssociatedCalendarItemId" xmlns:nsTypes={nsTypes}/>
				<nsTypes:FieldURI FieldURI="meeting:IsDelegated" xmlns:nsTypes={nsTypes}/>
				<nsTypes:FieldURI FieldURI="meeting:IsOutOfDate" xmlns:nsTypes={nsTypes}/>
				<nsTypes:FieldURI FieldURI="meeting:HasBeenProcessed" xmlns:nsTypes={nsTypes}/>
				<nsTypes:FieldURI FieldURI="meeting:ResponseType" xmlns:nsTypes={nsTypes}/>
				<nsTypes:FieldURI FieldURI="meetingRequest:MeetingRequestType" xmlns:nsTypes={nsTypes}/>
				<nsTypes:FieldURI FieldURI="meetingRequest:IntendedFreeBusyStatus" xmlns:nsTypes={nsTypes}/>
				</>;
*/

		var itemids = xml2json.addTag(req, "ItemIds", "nsMessages", null);
		for each (var item in this.ids) {
			var itemId = xml2json.addTag(itemids, "ItemId", "nsTypes", null);
			xml2json.setAttribute(itemId, "Id", item.Id);
			this.requestedItemId.push(item.Id);
			if (item.ChangeKey) {
				xml2json.setAttribute(itemId, "ChangeKey", item.ChangeKey);
			}
			if (item.index) {
				//exchWebService.commonFunctions.LOG("erGetTaskItemsRequest.execute. We have an index.");
				this.argument.occurrenceIndexes[item.Id] = item.index;
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


