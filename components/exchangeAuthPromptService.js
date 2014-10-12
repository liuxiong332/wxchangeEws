
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

var EXPORTED_SYMBOLS = ['exchangeAuthPromptService'];

function findInArray(array, callback, obj) {
	var func = obj? callback.bind(obj) : callback;
	for(var index = 0; index < array.length; ++index) {
		if(func(array[index]))
			return array[index];
	}
	return null;
}

function ExchangeAuthPrompt2() {
	this.passwordCache = {};
	this.details = {};

	this.timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	this.uuidGen = Cc["@mozilla.org/uuid-generator;1"]
		.getService(Ci.nsIUUIDGenerator);
	this.loginManager = Cc["@mozilla.org/login-manager;1"]
		.getService(Ci.nsILoginManager);
}

ExchangeAuthPrompt2.prototype = {

	getUserCanceled: function(aURL) {
		if (this.details[aURL]) {
			return this.details[aURL].canceled;
		}
		return false;
	},

	removeUserCanceled: function(aURL) {
		if (this.details[aURL]) {
			this.details[aURL].canceled = false;
		}
	},

	removePasswordCache: function(aUsername, aURL) {
		for (var name in this.passwordCache) {
			if (name.indexOf("|"+aURL)) {
				delete this.passwordCache[name];
			}
		}
	},

	getPassword: function(aChannel, username, aURL, aRealm,
		alwaysGetPassword, useCached) {
		var password = this.passwordCache[username+"|"+aURL];

		if (!password) {
			var savedPassword = this.passwordManagerGet(username, aURL, aRealm);
			if (savedPassword.result) {
				password = savedPassword.password;
			}
		}

		if ((password) && (aChannel) && (aChannel.URI.password)) {
			if ((password == decodeURIComponent(aChannel.URI.password))
				&& (!useCached)) {
				/* getPassword: There was a password in cache or passwordManager and one
				 * on the channel. And they are the same. Going to ask user to provide a
				 * new password.*/
				if ((this.details[aURL]) && (this.details[aURL].ntlmCount != 1)) {
					password = null;
				}
			}
		}
		if (!password) {
			if (!this.details[aURL]) 	return null;

			this.details[aURL].ntlmCount = 0;
			var answer = this.getCredentials(username, aURL);

			if (answer.result) {
				password = answer.password;
				if(answer.save)
					this.passwordManagerSave(username, password, aURL, realm);
				this.passwordCache[username+"|"+aURL] = password;
			} else {
				this.details[aURL].canceled = true;
			}
		}
		return password;
	},

	asyncPromptAuthNotifyCallback: function(aURL) {
		while (this.details[aURL].queue.length > 0) {
			var request = this.details[aURL].queue.shift();
			var aChannel = request.channel;
			var aCallback = request.callback;
			var aContext = request.context;
			var level = request.level;
			var authInfo = request.authInfo;
			var canUseBasicAuth = false;

			if (this.details[aURL].previousFailedCount > 4) {
				aCallback.onAuthCancelled(aContext, false);
				return;
			}

			var username;
			var password;
			var error = false;

			if (this.details[aURL].canceled) {
				error = true;
				aCallback.onAuthCancelled(aContext, true);
			} else {
				username = decodeURIComponent(aChannel.URI.username);

				if (!username) {
					aCallback.onAuthCancelled(aContext, false);
					error = true;
				}

				if (!error) {
					// Trying to get realm from response header. This is used when basic authentication is available.
					var realm = this.getRealmFromChannel(aChannel);
					if(realm)	canUseBasicAuth = true;
					realm || (realm = "exchange.server");

					// try to get password.
					try {
						password = this.getPassword(aChannel, username, aURL, realm, true,
							!(authInfo.flags & Ci.nsIAuthInformation.PREVIOUS_FAILED));
					} catch(err) {
						aCallback.onAuthCancelled(aContext, true);
						error = true;
					}

					if (!password) {
						error = true;
					} else {
						aChannel.URI.password = encodeURIComponent(password);
					}
				}
			}

			if (!error) {
				// Return credentials we have obtained
				if (!(authInfo.flags & Ci.nsIAuthInformation.ONLY_PASSWORD)) {
					if (authInfo.flags & Ci.nsIAuthInformation.NEED_DOMAIN) {
						if (username.indexOf("\\") > -1) {
							authInfo.domain = username.substr(0,username.indexOf("\\"));
							authInfo.username = username.substr(username.indexOf("\\")+1);
						} else {
							if (username.indexOf("@") > -1) {
								authInfo.username = username.substr(0,username.indexOf("@"));
								authInfo.domain = username.substr(username.indexOf("@")+1);
							} else {
								authInfo.username = username;
							}
						}
					} else {
						authInfo.username = username;
					}
				}

				authInfo.password = password;

				try {
					if (canUseBasicAuth == true) {
						var tok = authInfo.username + ':' + authInfo.password;
						var basicAuthHash = btoa(tok);
						try {
							aChannel.setRequestHeader('Authorization', "Basic " + basicAuthHash, true);
						}
						catch(err) {}
					}
					aCallback.onAuthAvailable(aContext, authInfo);
				} catch(err) {
					aCallback.onAuthCancelled(aContext, false);
				}
			}
		}
	},

	asyncPromptAuthCancelCallback: function(aReason, aURL, aUUID) {
		// Try to find the canceled request and remove from queue.
		var oldQueue = this.details[aURL].queue;
		this.details[aURL].queue = new Array();
		for (var index in oldQueue) {
			if (oldQueue[index].uuid == aUUID) {
				oldQueue[index].callback.onAuthCancelled(oldQueue[index].context, false);
			} else {
				this.details[aURL].queue.push(oldQueue[index]);
			}
		}
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

	generateUUID: function() {
		this.uuidGen.generateUUID().toString().replace(/[{}]/g, '');
	},

	getURLStrFromChannel: function(channel) {
		return decodeURIComponent(channel.URI.scheme + '://' +
			channel.URI.hostPort+channel.URI.path);
	},

	asyncPromptAuth: function(aChannel, aCallback, aContext, level, authInfo) {
		var channel = aChannel.QueryInterface(Ci.nsIHttpChannel);

		var URL = this.getURLStrFromChannel(aChannel);
		var uuid = this.generateUUID();

		if (!this.details[URL]) this.details[URL] = {
			showing: false,
			canceled: false,
			queue: new Array(),
			ntlmCount: 0,
			previousFailedCount: 0,
		};

		if (authInfo.flags & Ci.nsIAuthInformation.PREVIOUS_FAILED) {
			this.details[URL].previousFailedCount++;
		} else {
			this.details[URL].previousFailedCount = 0;
		}

		this.details[URL].queue.push( {
			uuid: uuid,
			channel: aChannel,
			callback: aCallback,
			context: aContext,
			level: level,
			authInfo: authInfo
		});

		var self = this;
		var notifyCallback = {
			notify: function asyncPromptAuth_notify() {
				self.asyncPromptAuthNotifyCallback(URL);
			}
		};
		this.timer.initWithCallback(notifyCallback, 0, Ci.nsITimer.TYPE_ONE_SHOT);

		var cancelCallback = {
			cancel: function asyncPromptAuth_cancel(aReason) {
				self.asyncPromptAuthCancelCallback(aReason, URL, uuid);
			}
		};
		return cancelCallback;
	},

	promptAuth: function(aChannel, level, authInfo) {
		var error = false;

		var URL = this.getURLStrFromChannel(aChannel);
		var password, username;

		if (this.details[URL].canceled) {
			return false;
		} else {
			username = decodeURIComponent(aChannel.URI.username);
			if (username == "") return false;

			var realm = this.getRealmFromChannel(aChannel) || "exchange.server";
			password = this.getPassword(aChannel, username, URL, realm);
			if (!password) 	return false;
		}

		if (!(authInfo.flags & Ci.nsIAuthInformation.ONLY_PASSWORD)) {
			if (authInfo.flags & Ci.nsIAuthInformation.NEED_DOMAIN) {
				if (this.username.indexOf("\\") > -1) {
					authInfo.domain = username.substr(0,username.indexOf("\\"));
					authInfo.username = username.substr(username.indexOf("\\")+1);
				}
				else {
					authInfo.domain = "";
					authInfo.username = username;
				}
			}
			else {
				authInfo.username = username;
			}
		}
		authInfo.password = password;
		return true;
	},

	/**
	 * Helper to retrieve an entry from the password manager.
	 *
	 * @param in  aUsername     The username to search
	 * @param aHostName         The corresponding hostname
	 * @param aRealm            The password realm (unused on branch)
	 * @return                  An object of form { result: boolean, [optional] password: <found password> }
	 *				result == false when password not found.
	 */
	passwordManagerGet: function(aUsername, aURL, aRealm) {
		try {
			var loginManager = this.loginManager;

			var logins = loginManager.findLogins({}, aURL, null, aRealm);
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
	passwordManagerSave: function(aUsername, aPassword, aURL, aRealm) {
		if ((!aUsername) || (!aURL) || (!aRealm)) 	return;

		var loginManager = this.loginManager;
		var logins = loginManager.findLogins({}, aURL, null, aRealm);

		var newLoginInfo = Cc["@mozilla.org/login-manager/loginInfo;1"]
			.createInstance(Ci.nsILoginInfo);
		newLoginInfo.init(aURL, null, aRealm, aUsername, aPassword, "", "");

		var loginInfo = findInArray(logins, function(loginInfo) {
			return loginInfo.username === aUsername;
		});

		if(loginInfo) {
			loginManager.modifyLogin(loginInfo, newLoginInfo);
		} else {
			loginManager.addLogin(newLoginInfo);
		}
	},

	passwordManagerRemove: function(aUsername, aURL, aRealm) {
		var logins = this.loginManager.findLogins({}, aURL, null, aRealm);
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
	 * @return                  An object of form { result: boolean, [optional] password: <found password>, save: boolean }
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
