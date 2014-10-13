
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import('resource://exchangeEws/commonFunctions.js');
var authLog = commonFunctions.Log
	.getInfoLevelLogger('exchangeAuthPromptService');

var EXPORTED_SYMBOLS = ['exchangeAuthPromptService'];

function findInArray(array, callback, obj) {
	var func = obj? callback.bind(obj) : callback;
	for(var index = 0; index < array.length; ++index) {
		if(func(array[index]))
			return array[index];
	}
	return null;
}

function PasswordCache() {
	this.cache = {};
}

PasswordCache.prototype = {
	getCache: function(user, url) {
		return this.cache[user + '|' + url];
	},

	setCache: function(user, url, pass) {
		this.cache[user + '|' + url] = pass;
	},

	removeCache: function(url) {
		for (var name in this.cache) {
			if (name.indexOf(url)) {
				delete this.cache[name];
			}
		}
	}
};


function ExchangeAuthPrompt2() {
	this.passwordCache = new PasswordCache;
	this.urlAuthList = {};

	this.timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	this.loginManager = Cc["@mozilla.org/login-manager;1"]
		.getService(Ci.nsILoginManager);
}

ExchangeAuthPrompt2.prototype = {

	getUserCanceled: function(aURL) {
		if (this.urlAuthList[aURL]) {
			return this.urlAuthList[aURL].canceled;
		}
		return false;
	},

	removeUserCanceled: function(aURL) {
		if (this.urlAuthList[aURL]) {
			this.urlAuthList[aURL].canceled = false;
		}
	},

	removePasswordCache: function(aUsername, aURL) {
		this.passwordCache.removeCache(aURL);
	},

	getPasswordFromCache: function(username, url) {
		var password = this.passwordCache.getCache(username, url);

		if (!password) {
			var savedPassword = this.passwordManagerGet(username, url);
			if (savedPassword.result) {
				password = savedPassword.password;
				this.passwordCache.setCache(username, url, password);
			}
		}
		return password;
	},

	getPassword: function(username, aURL, useCached) {
		authLog.info('get password username:' + username +
			', useCached: ' + useCached);
		var password = this.getPasswordFromCache(username, aURL);
		if(!useCached)
			password = null;

		if (!this.urlAuthList[aURL]) 	return null;
		if (!password) {
			var answer = this.getCredentials(username, aURL);

			if (answer.result) {
				password = answer.password;
				if(answer.save)
					this.passwordManagerSave(username, password, aURL);
				this.passwordCache.setCache(username, aURL, password);
			} else {
				this.urlAuthList[aURL].canceled = true;
			}
		}
		return password;
	},

	asyncPromptAuthNotifyCallback: function(aURL) {
		var urlInfo = this.urlAuthList[aURL];
		while (urlInfo.queue.length > 0) {
			var request = urlInfo.queue.shift();

			var channel = request.channel;
			var username = request.username;
			var callback = request.callback;
			var context = request.context;
			var authInfo = request.authInfo;

			if (urlInfo.previousFailedCount > 4) {
				callback.onAuthCancelled(context, false);
				return;
			}

			var password;
			if (urlInfo.canceled || !username) {
				callback.onAuthCancelled(context, true);
				continue;
			}

			password = this.getPassword(username, aURL,
				!(authInfo.flags & Ci.nsIAuthInformation.PREVIOUS_FAILED));
			if(!password)	{
				callback.onAuthCancelled(context, true);
				continue;
			}

			authLog.info('the username is:' + username);
			// Return credentials we have obtained
			if (authInfo.flags & Ci.nsIAuthInformation.ONLY_PASSWORD) {
				authInfo.username = username;
			} else if (authInfo.flags & Ci.nsIAuthInformation.NEED_DOMAIN) {
				if (username.indexOf("\\") > -1) {
					authInfo.domain = username.substr(0,username.indexOf("\\"));
					authInfo.username = username.substr(username.indexOf("\\")+1);
				} else if (username.indexOf("@") > -1) {
					authInfo.username = username.substr(0,username.indexOf("@"));
					authInfo.domain = username.substr(username.indexOf("@")+1);
				} else {
					authInfo.username = username;
				}
			}
			authInfo.password = password;
			setRequestHeader();
		}

		function setRequestHeader() {
			try {
				var tok = authInfo.username + ':' + authInfo.password;
				var basicAuthHash = btoa(tok);
				channel.setRequestHeader('Authorization', "Basic " +  basicAuthHash,
					true);
				callback.onAuthAvailable(context, authInfo);
			} catch(err) {
				callback.onAuthCancelled(context, false);
			}
		}
	},

	asyncPromptAuthCancelCallback: function(aReason, aURL, username) {
		// Try to find the canceled request and remove from queue.
		var urlInfo = this.urlAuthList[aURL];
		urlInfo.queue = urlInfo.queue.filter(function(request) {
			if(request.username === username) {
				request.callback.onAuthCancelled(request.context, false);
				return false;
			}
			return true;
		});
	},

	getRealmFromChannel: function(channel) {
		var auth = channel.getResponseHeader("WWW-Authenticate");
		var acceptAuths = auth? auth.split("\n") : [];
		for each (var index in acceptAuths) {
			if (index.indexOf("realm=") > -1) {
				return index.substr(index.indexOf("realm=")+6);
			}
		}
		return null;
	},


	getURLStrFromChannel: function(channel) {
		return decodeURIComponent(channel.URI.scheme + '://' +
			channel.URI.hostPort+channel.URI.path);
	},

	asyncPromptAuth: function(channel, aCallback, aContext, level, authInfo) {
		var url = this.getURLStrFromChannel(channel);
		var username = decodeURIComponent(channel.URI.username);

		if (!this.urlAuthList[url]) {
			this.urlAuthList[url] = {
				canceled: false,
				previousFailedCount: 0,
				queue: [],
			};
		}

		if (authInfo.flags & Ci.nsIAuthInformation.PREVIOUS_FAILED) {
			this.urlAuthList[url].previousFailedCount++;
		} else {
			this.urlAuthList[url].previousFailedCount = 0;
		}

		this.urlAuthList[url].queue.push( {
			channel: channel,
			username: username,
			callback: aCallback,
			context: aContext,
			authInfo: authInfo
		});

		var self = this;
		var notifyCallback = {
			notify: function() {
				self.asyncPromptAuthNotifyCallback(url);
			}
		};
		this.timer.initWithCallback(notifyCallback, 0, Ci.nsITimer.TYPE_ONE_SHOT);

		var cancelCallback = {
			cancel: function(reason) {
				self.asyncPromptAuthCancelCallback(reason, url, username);
			}
		};
		return cancelCallback;
	},

	// promptAuth: function(aChannel, level, authInfo) {
	// 	var error = false;
	// 	var URL = this.getURLStrFromChannel(aChannel);
	// 	var password, username;

	// 	if (this.urlAuthList[URL].canceled) {
	// 		return false;
	// 	} else {
	// 		username = decodeURIComponent(aChannel.URI.username);
	// 		if (username == "") return false;

	// 		var realm = this.getRealmFromChannel(aChannel) || "exchange.server";
	// 		password = this.getPassword(aChannel, username, URL, realm);
	// 		if (!password) 	return false;
	// 	}

	// 	if (!(authInfo.flags & Ci.nsIAuthInformation.ONLY_PASSWORD)) {
	// 		if (authInfo.flags & Ci.nsIAuthInformation.NEED_DOMAIN) {
	// 			if (this.username.indexOf("\\") > -1) {
	// 				authInfo.domain = username.substr(0,username.indexOf("\\"));
	// 				authInfo.username = username.substr(username.indexOf("\\")+1);
	// 			}
	// 			else {
	// 				authInfo.domain = "";
	// 				authInfo.username = username;
	// 			}
	// 		}
	// 		else {
	// 			authInfo.username = username;
	// 		}
	// 	}
	// 	authInfo.password = password;
	// 	return true;
	// },

	/**
	 * Helper to retrieve an entry from the password manager.
	 *
	 * @param in  aUsername     The username to search
	 * @param aHostName         The corresponding hostname
	 * @param aRealm            The password realm (unused on branch)
	 * @return                  An object of form { result: boolean,
	 * 	[optional] password: <found password> }
	 *				result == false when password not found.
	 */
	passwordManagerGet: function(aUsername, aURL) {
		try {
			var loginManager = this.loginManager;

			var logins = loginManager.findLogins({}, aURL, null, '');
			for each (var loginInfo in logins) {
				if (loginInfo.username == aUsername) {
					return { result: true, password: loginInfo.password};
				}
			}
		} catch (exc) {}
		return { result: false };
	},

	/**
	 * Helper to insert/update an entry to the password manager.
	 *
	 * @param aUserName     The username
	 * @param aPassword     The corresponding password
	 * @param aURL     The corresponding hostname
	 * @param aRealm        The password realm (unused on branch)
	 */
	passwordManagerSave: function(aUsername, aPassword, aURL) {
		if ((!aUsername) || (!aURL) ) 	return;

		var loginManager = this.loginManager;
		var logins = loginManager.findLogins({}, aURL, null, '');

		var newLoginInfo = Cc["@mozilla.org/login-manager/loginInfo;1"]
			.createInstance(Ci.nsILoginInfo);
		newLoginInfo.init(aURL, null, 'exchange', aUsername, aPassword, "", "");

		var loginInfo = findInArray(logins, function(loginInfo) {
			return loginInfo.username === aUsername;
		});

		if(loginInfo) {
			loginManager.modifyLogin(loginInfo, newLoginInfo);
		} else {
			loginManager.addLogin(newLoginInfo);
		}
	},

	passwordManagerRemove: function(aUsername, aURL) {
		var logins = this.loginManager.findLogins({}, aURL, null, '');
		var loginInfo = findInArray(logins, function(loginInfo) {
			return loginInfo.username === aUsername;
		});
		loginInfo && this.loginManager.removeLogin(loginInfo);
	},
	/**
	 * Helper to retrieve a password from the usr via a prompt.
	 *
	 * @param in  aUsername     The username to search
	 * @param in aURL           The corresponding hostname
	 * @return                  An object of form { result: boolean, [optional]
	 *  password: <found password>, save: boolean }
	 *				result == false when password not found.
	 */
	getCredentials: function(aUsername, aURL) {
		if ((!aUsername) || (!aURL)) {
			return { result: false };
		}
		var watcher = Cc["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Ci.nsIWindowWatcher);
		var prompter = watcher.getNewPrompter(null);

		var savepasswordMsg = 'need save password?'
		var aTitle = "Microsoft Exchange EWS: Password request.";
		var aText = 'input password.'
		var aPassword = { value: "" };
		var aSavePassword = { value: false };

		var result = prompter.promptPassword(aTitle, aText, aPassword,
			savepasswordMsg, aSavePassword);
		return { result: result,
			password: aPassword.value,
			save: aSavePassword.value
		};
	}
};

var exchangeAuthPromptService = new ExchangeAuthPrompt2;
