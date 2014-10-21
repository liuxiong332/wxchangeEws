

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
Cu.import('resource://exchangeEws/commonFunctions.js');

Cu.import("resource:///modules/gloda/log4moz.js");
var log = commonFunctions.Log.getInfoLevelLogger('ExchangeRequest');

function FileWriter(filePath) {
	var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
	file.initWithPath(filePath);
	!file.exists() && file.create(file.NORMAL_FILE_TYPE, 0666);
	this.file = file;
}
FileWriter.prototype.addFileLine = function(string) {
	var jsFrame = Components.stack.caller.caller;
	try {
    var filename = jsFrame.filename.slice(
      jsFrame.filename.lastIndexOf('/')+1);
    var prefixStr = '\n' + filename + ':' + jsFrame.name +
      ':' + jsFrame.lineNumber + '\n';
	} catch(e) {}
	return prefixStr + string + '\n';
};

FileWriter.prototype.writeIntoFile = function(string) {
	string = this.addFileLine(string);
	var charset = 'UTF-8';
	var fileStream = Cc['@mozilla.org/network/file-output-stream;1']
		.createInstance(Ci.nsIFileOutputStream);
	fileStream.init(this.file, 2, 0x200, false);
	var converterStream = Cc['@mozilla.org/intl/converter-output-stream;1']
		.createInstance(Ci.nsIConverterOutputStream);
	converterStream.init(fileStream, charset, 0,
		Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

	converterStream.writeString(string);
	converterStream.close();
	fileStream.close();
};

function fileWriter(string) {
	(new FileWriter('d:\\ExchangeRequest.log')).writeIntoFile(string);
}

var EXPORTED_SYMBOLS = ['ExchangeRequest', 'SoapExchangeRequest'];

/**
 * userInfo can contain the property:
 *		user: the user name
 *		password: optional password for the user, for test
 * aCbOk: callback when request successfully
 */
function ExchangeRequest(userInfo, aCbOk, aCbError) {
	this.mData = "";
	this.userInfo = userInfo;
	this.mCbOk = aCbOk;
	this.mCbError = aCbError;
 	this.currentUrl = "";

	this.xmlReq = null;
	this.shutdown = false;
}

ExchangeRequest.prototype = {
	stopRequest: function() {
		this.shutdown = true;
		this.xmlReq.abort();
	},

	prepareSendRequest: function(aData, url) {
		if (this.shutdown || !url) {
			return;
		}
		// log.info('send request for url:' + url);
		this.mData = aData;
		this.currentUrl = url;
		/*user donot resolve the bad certification problem or
		  user canceled providing a valid password for current url */
		if (exchangeCertService.userCanceledCertProblem(this.currentUrl) ||
			exchangeAuthPromptService.getUserCanceled(this.currentUrl)) {
			return;
		}
		var openUser = this.userInfo.user;
		var password = this.userInfo.password ||
			exchangeAuthPromptService.getPassword(null, openUser, this.currentUrl);

		this.xmlReq =
			Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();

		var self = this;
		this.xmlReq.addEventListener("error", function(event) {
			self.onError(event);
		});
		this.xmlReq.addEventListener("abort", function(event) {
			self.onAbort(event);
		});
		this.xmlReq.addEventListener("load", function(event) {
			self.onLoad(event);
		});

		try {
			if (password) {
				// log.info('open the xmlreq with the password:' + password);
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

		// this.xmlReq.timeout = 4000;	/*1s timeout*/
		this.xmlReq.ontimeout = function() {
			self.onTimeout();
		};

		this.xmlReq.overrideMimeType('text/plain');
		this.xmlReq.setRequestHeader("Content-Type", "text/xml");
		this.xmlReq.setRequestHeader("Connection", "keep-alive");


		this.xmlReq.channel.loadGroup = null;

		var httpChannel = this.xmlReq.channel.QueryInterface(Ci.nsIHttpChannel);
		// httpChannel.redirectionLimit = 0;
		httpChannel.allowPipelining = false;
	},

	sendRequest: function(aData, url) {
		this.prepareSendRequest(aData, url);
		/* set channel notifications for password processing */
		this.xmlReq.channel.notificationCallbacks = new RequestNotification(this);
		this.xmlReq.send(this.mData);
	},

	/**
	 * send request but don't ask for user to get the password when the
	 *  authenticate failed
	 */
	trySendRequest: function(aData, url) {
		this.prepareSendRequest(aData, url);
		/* set channel notifications for password processing */
		this.xmlReq.channel.notificationCallbacks =
			new RequestNotification(this, true);
		this.xmlReq.send(this.mData);
	},

	sendRequestForUrlList: function(data, urlList) {
		var originCbError = this.mCbError;
		var self = this;
		function sendOneRequest() {
			var url = urlList.shift();
			self.sendRequest(data, url);
		}

		this.mCbError = function(request, code, msg) {
			if(urlList.length == 0)
				return originCbError(request, code, msg);
			sendOneRequest();
		}
		sendOneRequest();
	},

	onError: function(event) {
		// log.info('request Error! the status is:' + this.xmlReq.status);
		let xmlReq = this.xmlReq;
		if ((!this.shutdown) && (xmlReq.readyState == 4) && (xmlReq.status == 0)) {
			//badCert going to check if it is a cert problem
			var result = exchangeCertService.checkAndSolveCertProblem(this.currentUrl);
			if (result.hadProblem && result.solved) {
					//badCert problem but solved. going to retry url.");
					this.sendRequest(this.mData, this.currentUrl);
					return;
			}
		}
		if (this.isHTTPRedirect(event)) return;
		this.requestError(xmlReq.statusText, xmlReq.responseText);
	},

	onAbort: function() {
		log.info('request Abort!');
		this.requestError('RequestAbort');
	},

	isHTTPRedirect: function() {
		let xmlReq = this.xmlReq;
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

	onTimeout: function() {
		log.info('request timeout');
		this.requestError('RequestTimeOut');
	},

	onLoad: function(event) {
		// log.info('load successfully');
		var xmlReq = this.xmlReq;

		if(this.isHTTPRedirect(event))	return;
		if(xmlReq.status !== 200) {
			return this.requestError(xmlReq.statusText, xmlReq.responseText);
		}
		var xml = xmlReq.responseText;
		fileWriter(xml);
		var newXML = Xml2jxonObj.createFromXML(xml);

		if (this.mCbOk) {
			this.mCbOk(this, newXML);
		}
	},

	requestError: function(aCode, aMsg) {
		if (this.mCbError) {
			this.mCbError(this, aCode, aMsg);
		}
	},
};

function SoapExchangeRequest(userInfo, aCbOk, aCbError) {
	ExchangeRequest.apply(this, arguments);
	var originCbOk = this.mCbOk;

	this.mCbOk = function(request, xmlObj) {
		if(this.processSoapErrorMsg(xmlObj)) return ;
		var bodyObj = xmlObj.XPath('/soap:Envelope/soap:Body/*');
		if(bodyObj.length === 0) {
			return this.requestError('NotBodyFound');
		}
		//if request is SOAP, return the body child xml2jxonObj
		originCbOk && originCbOk(this, bodyObj[0]);
	}
}

SoapExchangeRequest.prototype = {
	processSoapErrorMsg: function(aResp) {
		var rm = aResp.XPath(
			'/s:Envelope/s:Body/*/m:ResponseMessages/*[@ResponseClass="Error"]');
		if (rm.length > 0) {
			var msgText = rm[0].getChildTagValue('m:MessageText', '');
			var responseCode = rm[0].getChildTagValue('m:ResponseCode', '');
			this.requestError(msgText, responseCode);
			return true;
		}
		return false;
	},
};

function inherit(baseClass, inheritClass) {
	var methods = inheritClass.prototype;
	inheritClass.prototype = Object.create(baseClass.prototype);
	for(var method in methods) {
		inheritClass.prototype[method] = methods[method];
	}
}
inherit(ExchangeRequest, SoapExchangeRequest);

function RequestNotification(aExchangeRequest, notAuthPrompt) {
}

RequestNotification.prototype = {
	getInterface: function(iid) {
		if(iid.equals(Ci.nsIAuthPrompt2) && !notAuthPrompt) {
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
