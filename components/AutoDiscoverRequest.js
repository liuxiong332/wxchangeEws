

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Cu.import("resource://exchangeEws/ExchangeRequest.js");
Cu.import('resource://exchangeEws/Xml2jxonObj.js');

var EXPORTED_SYMBOLS = ["AutoDiscoverRequest"];

function AutoDiscoverRequest(emailInfo, aCbOk, aCbError) {
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;
	this.emailInfo = emailInfo;

	this.request = new ExchangeRequest(emailInfo,
		this.onSendOk.bind(this), this.onSendError.bind(this));
	this.mailbox = aArgument.mailbox;

	this.execute();
}

AutoDiscoverRequest.prototype = {

	execute: function() {
		/* This autodiscover is of the type POX
		   (http://msdn.microsoft.com/en-us/library/bb204189.aspx)
			 This is compatible with exchange 2007 and 2010. For 2010 we could also
			 use SOAP
			 (http://msdn.microsoft.com/en-us/library/dd877096%28v=EXCHG.140%29.aspx)
		   */
 		var email = this.mailbox;
    var domain = email.split("@")[1];
		var urllist = [
			"https://" + domain + "/autodiscover/autodiscover.xml",
			"https://autodiscover." + domain + "/autodiscover/autodiscover.xml",
			"http://autodiscover." + domain + "/autodiscover/autodiscover.xml"
		];

		var req = Xml2jxonObj.createFromXML('<Autodiscover xmlns=' +
			'"http://schemas.microsoft.com/exchange/autodiscover' +
			'/outlook/requestschema/2006"/>');
		var request = req.addChildTag("Request", null, null);
		request.addChildTag("EMailAddress", null, email);
		request.addChildTag("AcceptableResponseSchema", null,
			'http://schemas.microsoft.com/exchange/autodiscover' +
			'/outlook/responseschema/2006a');

		var xml_tag = '<?xml version="1.0" encoding="utf-8"?>\n';
		this.request.sendRequestForUrlList(xml_tag + req.toString(), urllist);
	},

	onSendOk: function(aExchangeRequest, aResp)
	{
		exchWebService.commonFunctions.LOG("sendAutodiscover.onSendOk:"+String(aResp));
		var DisplayName = "";
		var SMTPaddress = "";
		var redirectAddr = null;
		var ewsUrls = "";
		var aError = true;
		var aCode = -1;
		var aMsg = String(aResp);

		// Try to see if we get a redirectAddr Action
		var account = aResp.XPath("/a1:Autodiscover/a2:Response/a2:Account[a2:Action ='redirectAddr']");
		if (account.length > 0) {
			// We have an redirectAddr. Send OK back but with the redirectAddr set.
			redirectAddr = account[0].getTagValue("a2:RedirectAddr", null);
			if ((this.mCbOk) && (redirectAddr)) {
				//this.isRunning = false;
				this.mCbOk(ewsUrls, DisplayName, SMTPaddress, redirectAddr);
			}
			if (aError) {
				this.onSendError(aExchangeRequest, aCode, aMsg);
			}
			this.isRunning = false;
			return;
		}
		account = null;

		// Try to get the Displayname if it is available
		var tag = aResp.XPath("/a1:Autodiscover/a2:Response/a2:User/a2:DisplayName");
		if (tag.length > 0) {
			DisplayName = tag[0].value;
		}
		else {
			exchWebService.commonFunctions.LOG("autodiscoverOk but Displayname is not available.");
		}
		tag = null;

		// Try to get the SMTP address if it is available
		var tag = aResp.XPath("/a1:Autodiscover/a2:Response/a2:User/a2:AutoDiscoverSMTPAddress");
		if (tag.length > 0) {
			SMTPaddress = tag[0].value;
		}
		else {
			exchWebService.commonFunctions.LOG("autodiscoverOk but AutoDiscoverSMTPAddress is not available.");
		}
		tag = null;

		// Try to get the EWS urls if they are available
		ewsUrls = aResp.XPath("/a1:Autodiscover/a2:Response/a2:Account/a2:Protocol[a2:Type='WEB']/*/a2:Protocol/a2:ASUrl");
		if (ewsUrls.length > 0) {
			exchWebService.commonFunctions.LOG(" cc protocol type WEB:"+ewsUrls+".");
			aError = false;
		}
		else {
			ewsUrls = aResp.XPath("/a1:Autodiscover/a2:Response/a2:Account/a2:Protocol[a2:Type='EXCH']/a2:EwsUrl");
			if (ewsUrls.length > 0) {
				exchWebService.commonFunctions.LOG(" cc protocol type EXCH:"+ewsUrls+".");
				aError = false;
			}
			else {
				aMsg = "autodiscoverOk error getting ewsUrls from:"+this.parent.currentUrl;
				aCode = this.parent.ER_ERROR_AUTODISCOVER_GET_EWSULR;
				aError = true;
			}
		}

		if (aError) {
			this.onSendError(aExchangeRequest, aCode, aMsg);
		}
		else {
			if (this.mCbOk) {
				this.mCbOk(ewsUrls, DisplayName, SMTPaddress, redirectAddr);
			}
		}
		this.isRunning = false;
		ewsUrls = null;
	},

	onSendError: function _onSendError(aExchangeRequest, aCode, aMsg)
	{
		exchWebService.commonFunctions.LOG("sendAutodiscover.onSendError: aCode:"+aCode+", aMsg:"+aMsg);
		this.isRunning = false;
		if (this.mCbError) {
			this.mCbError(this, aCode, aMsg);
		}
	},
};


