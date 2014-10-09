

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://exchangeEws/Xml2jxonObj.js");
Cu.import('resource://exchangeEws/exchangeCertService.js');
Cu.import('resource://exchangeEws/exchangeAuthPromptService.js');

var EXPORTED_SYMBOLS = ["ExchangeRequest"];

function ExchangeRequest(aArgument, aCbOk, aCbError) {
	this.mData = "";
	this.mArgument = aArgument;
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;
 	this.currentUrl = "";

	this.xmlReq = null;
	this.shutdown = false;
	this._notificationCallbacks = null;
}

ExchangeRequest.prototype = {
	ER_ERROR_EMPTY_FOLDERPATH: -2,
	ER_ERROR_INVALID_URL: -6, 	// "No url to send request to."
	ER_ERROR_RESPONS_NOT_VALID: -7, // "Respons does not contain expected field"
	ER_ERROR_SOAP_ERROR: -8,	// "Error on creating item:"+responseCode
	ER_ERROR_RESOLVING_HOST: -9,    // "Error during resolving of hostname"
	ER_ERROR_CONNECTING_TO: -10,    // "Error during connecting to hostname"
	ER_ERROR_CREATING_ITEM_UNKNOWN: -13, // "Error. Unknown item creation:"+String(aResp)

	ER_ERROR_CONNECED_TO: -14, // "Error during connection to hostname '"
	ER_ERROR_SENDING_TO: -15,  // "Error during sending data to hostname '"
	ER_ERROR_WAITING_FOR: -16, // "Error during waiting for data of hostname '"
	ER_ERROR_RECEIVING_FROM: -17, // "Error during receiving of data from hostname '"
	ER_ERROR_UNKNOWN_CONNECTION: -18, // "Unknown error during communication with hostname
	ER_ERROR_HTTP_ERROR4XX: -19,  // A HTTP 4XX error code was returned.

	ER_ERROR_USER_ABORT_AUTHENTICATION: -20,	// "User aborted authentication credentials"
	ER_ERROR_USER_ABORT_ADD_CERTIFICATE: -30,	// "User aborted adding required certificate"
	ER_ERROR_OPEN_FAILED: -100,	// "Could not connect to specified host:"+err
	ER_ERROR_FROM_SERVER: -101,	// HTTP error from server.
	ER_ERROR_AUTODISCOVER_GET_EWSULR: -200,  // During auto discovery no EWS URL were discoverd in respons.
	ER_ERROR_FINDFOLDER_NO_TOTALITEMSVIEW: -201, // Field totalitemsview missing in soap response.
	ER_ERROR_FINDFOLDER_FOLDERID_DETAILS: -202, // Could not find folderid details in soap response.
	ER_ERROR_FINDFOLDER_MULTIPLE_RESULTS: -203, // Found more than one results in the findfolder soap response.
	ER_ERROR_FINDOCCURRENCES_INVALIDIDMALFORMED: -204, // Found an malformed id during find occurrences.
	ER_ERROR_GETOCCURRENCEINDEX_NOTFOUND: -205,  // Could not found occurrence index.
	ER_ERROR_SOAP_RESPONSECODE_NOTFOUND: -206, // Could not find the responce field in the soap response.
	ER_ERROR_PRIMARY_SMTP_NOTFOUND: -207, // Primary SMTP address could not be found in soap response.
	ER_ERROR_PRIMARY_SMTP_UNKNOWN: -208,  // Unknown error during Primary SMTP check.
	ER_ERROR_UNKNOWN_MEETING_REPSONSE: -209, // Unknown Meeting Response.
	ER_ERROR_SYNCFOLDERITEMS_UNKNOWN: -210, // Unknown error during SyncFolders.
	ER_ERROR_ITEM_UPDATE_UNKNOWN: -211,  // Unknown error during item ipdate.
	ER_ERROR_SPECIFIED_SMTP_NOTFOUND: -212, // Specified SMTP address does not exist.
	ER_ERROR_CONVERTID: -214, // Specified SMTP address does not exist.
	ER_ERROR_NOACCESSTOFREEBUSY: -215, // Specified user has no access to free/busy information of specified mailbox.
	ER_ERROR_FINDOCCURRENCES_UNKNOWN: -216, // We received an unkown error while trying to get the occurrences.

	ERR_PASSWORD_ERROR: -300, // To many password errors.

	get argument() {
		return this.mArgument;
	},

	get user()
	{
		return this.argument.user;
	},

	set user(aValue)
	{
		this.argument.user = aValue;
	},

	stopRequest: function() {
		this.shutdown = true;
		this.xmlReq.abort();
	},

	sendRequest: function(aData, aUrl) {
		if (this.shutdown || !aUrl) {
			return;
		}
		this.mData = aData;
		this.currentUrl = aUrl;
		/*user donot resolve the bad certification problem or
		  user canceled providing a valid password for current url */
		if (exchangeCertService.userCanceledCertProblem(this.currentUrl) ||
			exchangeAuthPromptService.getUserCanceled(this.currentUrl)) {
			return;
		}
		var openUser = this.mArgument.user;

		var password = this.mArgument.password ||
			exchangeAuthPromptService.getPassword(null, openUser, this.currentUrl);

		this.xmlReq =
			Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

		this.mXmlReq = this.xmlReq;
		var self = this;
		this.xmlReq.addEventListener("error", function(event) {
			self.onError(event);
		}, false);
		this.xmlReq.addEventListener("abort", function(event) {
			self.onAbort(event);
		}, false);
		this.xmlReq.addEventListener("load", function(event) {
			self.onLoad(event);
		}, false);

		try {
			if (password) {
				this.xmlReq.open("POST", this.currentUrl, true, openUser, password);

				var tok = openUser + ':' + password;
				var basicAuthHash = btoa(tok);
				this.xmlReq.setRequestHeader('Authorization', "Basic " + basicAuthHash);
			} else {
				this.xmlReq.open("POST", this.currentUrl, true, openUser);
			}
		} catch(err) {
			return;
		}
		this.xmlReq.overrideMimeType('text/xml');
		this.xmlReq.setRequestHeader("Content-Type", "text/xml");
		this.xmlReq.setRequestHeader("Connection", "keep-alive");

		/* set channel notifications for password processing */
		this.xmlReq.channel.notificationCallbacks = new RequestNotification(this);
		this.xmlReq.channel.loadGroup = null;

		var httpChannel = this.xmlReq.channel.QueryInterface(Ci.nsIHttpChannel);

		httpChannel.redirectionLimit = 0;
		httpChannel.allowPipelining = false;
		this.xmlReq.send(this.mData);
	},

	onError: function(event) {
		let xmlReq = this.mXmlReq;
		if ((!this.shutdown) && (xmlReq.readyState == 4) && (xmlReq.status == 0)) {
			//badCert going to check if it is a cert problem
			var result = exchangeCertService.checkAndSolveCertProblem(this.currentUrl);
			if (result.hadProblem && result.solved) {
					//badCert problem but solved. going to retry url.");
					this.retryCurrentUrl();
					return;
			}
		}

		if (this.isHTTPRedirect(evt)) return;
	},

	onAbort: function(evt) {
		this.requestError('RequestAbort');
	},

	onUserStop: function(aCode, aMsg) {
		this.mXmlReq.abort();
	},

	isHTTPRedirect: function(evt) {
		let xmlReq = this.mXmlReq;
		switch (xmlReq.status) {
		case 301:  // Moved Permanently
		case 302:  // Found
		case 307:  // Temporary redirect (since HTTP/1.1)
			let httpChannel = xmlReq.channel.QueryInterface(Ci.nsIHttpChannel);
			let loc = httpChannel.getResponseHeader("Location");
			// The location could be a relative path
			if (!/\s*http/.test(loc)) {
				if (loc.indexOf("/") == 0) {
					var regRes = /^[^\/]+\/\/[^\/]+\//.exec(loc);
					regRes && (loc = regRes[0] + loc);
				} else { //relative to the origin url
					loc = this.currentUrl + loc;
				}
			}
      this.sendRequest(this.mData, loc);
			return true;
		}
		return false;
	},

	onLoad: function(event) {
		let xmlReq = this.mXmlReq;
		if (xmlReq.readyState != 4) {
			return;
		}

		this.isHTTPRedirect(event) && return ;
		var contentType = xmlReq.getResponseHeader('Content-Type');
		if(xmlReq.status !== 200 || contentType !== 'text/xml') {
			return this.requestError(xmlReq.statusText, xmlReq.responseText);
		}
		var xml = xmlReq.responseText;
		var newXML = Xml2jxonObj.createFromXML(xml);

		if (this.mCbOk) {
			try {
				this.mCbOk(this, newXML);
			} catch(err) {}
		}
		newXML = null;
	},

	retryCurrentUrl: function() {
		this.sendRequest(this.mData, this.currentUrl);
	},

  isHTTPError: function() {
    let xmlReq = this.mXmlReq;
   	// See Other (since HTTP/1.1) new request should be a GET instead of a POST.
		if (xmlReq.status ==  303) {
			requestError(xmlReq.status, 'HTTPSeeOther');
    	return true;
		}

    if ((xmlReq.status > 399) && (xmlReq.status < 500)) {
			var errMsg = "";
			switch (xmlReq.status) {
			case 400: errMsg = "Bad request"; break;
			case 401: errMsg = "Unauthorized"; break;
			case 402: errMsg = "Payment required"; break;
			case 403: errMsg = "Forbidden"; break;
			case 404: errMsg = "Not found"; break;
			case 405: errMsg = "Method not allowed"; break;
			case 406: errMsg = "Not acceptable"; break;
			case 407: errMsg = "Proxy athentication required"; break;
			case 408: errMsg = "Request timeout"; break;
			case 409: errMsg = "Conflict"; break;
			case 410: errMsg = "Gone"; break;
			case 411: errMsg = "Length required"; break;
			case 412: errMsg = "Precondition failed"; break;
			case 413: errMsg = "Request entity too large"; break;
			case 414: errMsg = "Request-URI too long"; break;
			case 415: errMsg = "Unsupported media type"; break;
			case 416: errMsg = "Request range not satisfiable"; break;
			case 417: errMsg = "Expectation failed"; break;
			case 418: errMsg = "I'm a teapot(RFC 2324)"; break;
			case 420: errMsg = "Enhance your calm (Twitter)"; break;
			case 422: errMsg = "Unprocessable entity (WebDAV)(RFC 4918)"; break;
			case 423: errMsg = "Locked (WebDAV)(RFC 4918)"; break;
			case 424: errMsg = "Failed dependency (WebDAV)(RFC 4918)"; break;
			case 425: errMsg = "Unordered collection (RFC 3648)"; break;
			case 426: errMsg = "Upgrade required (RFC2817)"; break;
			case 428: errMsg = "Precondition required"; break;
			case 429: errMsg = "Too many requests"; break;
			case 431: errMsg = "Request header fields too large"; break;
			case 444: errMsg = "No response"; break;
			case 449: errMsg = "Retry with"; break;
			case 450: errMsg = "Blocked by Windows Parental Controls"; break;
			case 499: errMsg = "Client closed request"; break;
			}
      return true;
    }

    if ((xmlReq.status > 499) && (xmlReq.status < 600)) {
			var errMsg = "";
			switch (xmlReq.status) {
			case 500: errMsg = "Internal server error";	break;
			case 501: errMsg = "Not implemented"; break;
			case 502: errMsg = "Bad gateway"; break;
			case 503: errMsg = "Service unavailable"; break;
			case 504: errMsg = "Gateway timeout"; break;
			case 505: errMsg = "HTTP version not supported"; break;
			case 506: errMsg = "Variant also negotiates (RFC 2295)"; break;
			case 507: errMsg = "Insufficient Storage (WebDAV)(RFC 4918)"; break;
			case 508: errMsg = "Loop detected (WebDAV)(RFC 4918)"; break;
			case 509: errMsg = "Bandwith limit exceeded (Apache bw/limited extension)"; break;
			case 510: errMsg = "Not extended (RFC 2774)"; break;
			case 511: errMsg = "Network authentication required"; break;
			case 598: errMsg = "Network read timeout error"; break;
			case 599: errMsg = "Network connect timeout error"; break;
			}

		}
  }

	requestError: function(aCode, aMsg) {
		if (this.mCbError) {
			this.mCbError(this, aCode, aMsg);
		}
	},

	processSoapErrorMsg: function(aResp) {
		var rm = aResp.XPath("/s:Envelope/s:Body/*/m:ResponseMessages/*[@ResponseClass='Error']");
		var result;
		if (rm.length > 0) {
			var msgText = rm[0].getChildTagValue('m:MessageText', '');
			var responseCode = rm[0].getChildTagValue('m:ResponseCode', '');
			requestError(msgText, responseCode);
		}
	}
};

function RequestNotification(aExchangeRequest) {
}

RequestNotification.prototype = {
	getInterface: function(iid) {
		if(iid.equals(Ci.nsIAuthPrompt2) {
			return exchangeAuthPromptService;
		} else if(iid.equals(Ci.nsIBadCertListener2)) {
			return exchangeCertService;
		} else if(iid.equals(Ci.nsIProgressEventSink)) {
    	return this;
		} else if(iid.equals(Ci.nsISecureBrowserUI)) {
    	return Cr.NS_NOINTERFACE;
		} else if(iid.equals(Ci.nsIDocShellTreeItem)) {
  		return Cr.NS_NOINTERFACE;
		} else if(iid.equals(Ci.nsIAuthPromptProvider)) {
			return Cr.NS_NOINTERFACE;
		} else if(iid.equals(Ci.nsIChannelEventSink)) {
  		return this;
		} else if(iid.equals(Ci.nsIRedirectResultListener)) {
  		return this;
		} else if(iid.equals(Ci.nsILoadContext)) {
			return Cr.NS_NOINTERFACE;  // We do not support this.
		} else if(iid.equals(Ci.nsIApplicationCacheContainer)) {
			// The next iid is called when the TB goes into offline mode.
			return Cr.NS_NOINTERFACE;
		}
		return Cr.NS_NOINTERFACE;
	},

	// nsIProgressEventSink
	onProgress: function(aRequest, aContext, aProgress, aProgressMax) {
	},

	// nsIProgressEventSink
	onStatus: function(aRequest, aContext, aStatus, aStatusArg) {
	},

	asyncOnChannelRedirect: function(oldChannel, newChannel, flags, callback) {
    newChannel.notificationCallbacks = this;
    callback.onRedirectVerifyCallback(Cr.NS_OK);
	},

	//void onRedirectResult(in boolean proceeding);
	onRedirectResult: function (proceeding) {
	},
}
