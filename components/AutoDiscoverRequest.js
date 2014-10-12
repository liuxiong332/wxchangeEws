

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

	this.request = new ExchangeRequest(emailInfo,
		this.onSendOk.bind(this), this.onSendError.bind(this));
	this.mailbox = emailInfo.mailbox;

	this.execute();
}

AutoDiscoverRequest.prototype = {

	generateReqStr: function() {
		var email = this.mailbox;
    var domain = email.split("@")[1];

		var req = Xml2jxonObj.createFromXML('<Autodiscover xmlns=' +
			'"http://schemas.microsoft.com/exchange/autodiscover' +
			'/outlook/requestschema/2006"/>');
		var request = req.addChildTag("Request", null, null);
		request.addChildTag("EMailAddress", null, email);
		request.addChildTag("AcceptableResponseSchema", null,
			'http://schemas.microsoft.com/exchange/autodiscover' +
			'/outlook/responseschema/2006a');

		var xml_tag = '<?xml version="1.0" encoding="utf-8"?>\n';
		this.reqStr = xml_tag + req.toString();
	},

	execute: function() {
		/* This autodiscover is of the type POX
		   (http://msdn.microsoft.com/en-us/library/bb204189.aspx)
			 This is compatible with exchange 2007 and 2010. For 2010 we could also
			 use SOAP
			 (http://msdn.microsoft.com/en-us/library/dd877096%28v=EXCHG.140%29.aspx)
		   */
	  this.generateReqStr();

	  var domain = this.mailbox.split("@")[1];
	  var urllist = [
			"https://" + domain + "/autodiscover/autodiscover.xml",
			"https://autodiscover." + domain + "/autodiscover/autodiscover.xml",
			"http://autodiscover." + domain + "/autodiscover/autodiscover.xml"
		];
		this.request.sendRequestForUrlList(this.reqStr, urllist);
	},

	onSendOk: function(request, xmlObj) {
		var redirectAddr = null;
		// Try to see if we get a redirectAddr Action
		var redirectPath = '/Autodiscover/Response/Account[Action ="redirectAddr"]';
		var account = xmlObj.XPath(redirectPath);
		if (account.length > 0) {
			// We have an redirectAddr, redirect to this address
			redirectAddr = account[0].getChildTagValue("RedirectAddr", null);
			this.mailbox = redirectAddr;
			this.execute();
			return;
		}
		// Try to get the EWS urls if they are available
		var ewsPath =
			'/Autodiscover/Response/Account/Protocol[Type="EXCH"]/EwsUrl';
		var urlObjs = xmlObj.XPath(ewsPath);
		if(urlObjs.length === 0) {
			ewsPath =
				'/Autodiscover/Response/Account/Protocol[Type="WEB"]/*/Protocol/ASUrl';
			urlObjs = xmlObj.XPath(ewsPath);
		}

		if (urlObjs.length > 0) {
			var ewsUrl = urlObjs[0].getValue();
			this.mCbOk && this.mCbOk(this, ewsUrl);
			return ;
		}
		this.onSendError(request, 'NotFoundElement');
	},

	onSendError: function(aExchangeRequest, aCode, aMsg) {
		this.mCbError && this.mCbError(this, aCode, aMsg);
	},
};


