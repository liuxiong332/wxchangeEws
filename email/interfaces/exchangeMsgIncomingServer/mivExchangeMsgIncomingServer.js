
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://exchangeEws/commonFunctions.js");

var serverLog = commonFunctions.Log.getInfoLevelLogger('exchange-server');

function mivExchangeMsgIncomingServer() {

	//this.logInfo("mivExchangeMsgIncomingServer: init");
	this._ewsUrl = null;
	this._serverKey = "exchange-ews-mail";
	this._prettyName = "Microsoft Exchange Mail Service";
	this._type = "exchange";

	this._userName = null;
	this._hostName = null;
 	this._rootFolder = null;
 	this._password = null;

  this._localPath = null;

 	this._msgStore = null;
 	this._filterList = null;
 	//the preference branch for the server
	this._prefBranch = null;
	this.resetPrefBranch();
	this._defaultPrefBranch = mivExchangeMsgIncomingServer.getBranch(
		"mail.server.default.");
}

var mivExchangeMsgIncomingServerGUID = "79d87edc-020e-48d4-8c04-b894edab4bd2";

var PROTOCOL_NAME = "exchange";

mivExchangeMsgIncomingServer.getBranch = function(branchName) {
	return Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService)
    .getBranch(branchName);
};

mivExchangeMsgIncomingServer.createNewFile = function() {
	return Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
}
//create a new preference for the file and the relative key to the directory
// @param file: nsIFile
// @param relativeToKey a directory service key for the directory
mivExchangeMsgIncomingServer.newRelativeFilePref = function(file,
  relativeToKey) {
	var local = Cc["@mozilla.org/pref-relativefile;1"]
    .createInstance(Ci.nsIRelativeFilePref);
	local.file = file;
	local.relativeToKey = relativeToKey;
	return local;
}

mivExchangeMsgIncomingServer.loginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);

mivExchangeMsgIncomingServer.prototype = {

	QueryInterface : XPCOMUtils.generateQI([Ci.mivExchangeMsgIncomingServer,
				Ci.nsIMsgIncomingServer,
				Ci.nsIClassInfo,
				Ci.nsISupports]),

	_className : "mivExchangeMsgIncomingServer",

	classDescription : "Exchange EWS Msg Incoming server",

	classID : components.ID("{"+mivExchangeMsgIncomingServerGUID+"}"),
	contractID : "@mozilla.org/messenger/protocol/info;1?type=exchange",
	flags : Ci.nsIClassInfo.THREADSAFE,
	implementationLanguage : Ci.nsIProgrammingLanguage.JAVASCRIPT,

	getInterfaces : function _getInterfaces(count)
	{
		var ifaces = [Ci.mivExchangeMsgIncomingServer,
				Ci.nsIMsgIncomingServer,
				Ci.nsIClassInfo,
				Ci.nsISupports];
		count.value = ifaces.length;
		return ifaces;
	},

  /**
   * internal pref key - guaranteed to be unique across all servers
   */
  //  attribute ACString key;
	//when the key change, the branch preference change
	resetPrefBranch : function() {
		var branchName = "mail.server." + this._serverKey + ".";
		this._prefBranch = mivExchangeMsgIncomingServer.getBranch(branchName);
	},

	get key() {
		return this._serverKey;
	},

	set key(aValue) {
		this._serverKey = aValue;
		this.resetPrefBranch();
	},

	get ewsUrl() {
		return this._ewsUrl;
	},

	set ewsUrl(value) {
		this._ewsUrl = value;
	},
  /**
   * pretty name - should be "userid on hostname"
   * if the pref is not set
   */
	get prettyName()
	{
		return this._prettyName;
	},

	set prettyName(aValue)
	{
		this._prettyName = aValue;
	},

  /**
  * helper function to construct the pretty name in a server type
  * specific way - e.g., mail for foo@test.com, news on news.mozilla.org
  */
  //  readonly attribute AString constructedPrettyName;
	get constructedPrettyName()
	{
		return this.prettyName;
	},

  /**
   * hostname of the server
   */
  //  attribute ACString hostName;
	get hostName()
	{
		return this._hostName;
	},

	set hostName(aValue)
	{
		this._hostName = aValue;
	},

  /**
   * real hostname of the server (if server name is changed it's stored here)
   */
//  attribute ACString realHostName;
	get realHostName()
	{
		return this.hostName;
	},

	set realHostName(aValue)
	{
		this.hostName = aValue;
	},

  /* port of the server */
//  attribute long port;
	get port()
	{
		return 443;
	},

	set port(aValue)
	{
	},

  /**
   * userid to log into the server
   */
//  attribute ACString username;
	get username()
	{
		return this._userName;
	},

	set username(aValue)
	{
		this._userName = aValue;
	},

  /**
   * real username of the server (if username is changed it's stored here)
   */
//  attribute ACString realUsername;
	get realUsername()
	{
		return this.username;
	},

	set realUsername(aValue)
	{
		this.username = aValue;
	},

  /**
   * protocol type, i.e. "pop3", "imap", "nntp", "none", etc
   * used to construct URLs
   */
//  attribute ACString type;
	get type()
	{
		return this._type;
	},

	set type(aValue)
	{
		this._type = aValue;
	},

//  readonly attribute AString accountManagerChrome;
	get accountManagerChrome()
	{
		return "chrome://exchangemail/am-main.xul";
	},

  /**
   * the schema for the local mail store, such
   * as "mailbox", "imap", or "news"
   * used to construct URIs
   */
  //  readonly attribute ACString localStoreType;
	get localStoreType()
	{
		return "mailbox";
	},

	getProtocolInfo: function() {
		if(!this._protocolInfo) {
			let protocolStr = "@mozilla.org/messenger/protocol/info;1?type=" + this.type;
			this._protocolInfo =
				Cc[protocolStr].createInstance(Ci.nsIMsgProtocolInfo);
		}
		return this._protocolInfo;
	},

	set protocolInfo(info) {
		this._protocolInfo = info;
	},

	get protocolInfo() {
		return this.getProtocolInfo();
	},
  // Perform specific tasks (reset flags, remove files, etc) for account user/server name changes.
//  void onUserOrHostNameChanged(in ACString oldName, in ACString newName,
//                               in bool hostnameChanged);
	onUserOrHostNameChanged: function _onUserOrHostNameChanged(oldName, newName, hostnameChanged)
	{
		dump("function onUserOrHostNameChanged\n");
	},

  /* cleartext version of the password */
//  attribute ACString password;
	get password()
	{
		return this._password;
	},

	set password(aValue)
	{
		this._password = aValue;
	},

  /**
   * Attempts to get the password first from the password manager, if that
   * fails it will attempt to get it from the user if aMsgWindow is supplied.
   *
   * @param aPromptString  The text of the prompt if the user is prompted for
   *                       password.
   * @param aPromptTitle   The title of the prompt if the user is prompted.
   * @param aMsgWindow     A message window to associate the prompt with.
   * @return               The obtained password. Could be an empty password.
   *
   * @exception NS_ERROR_FAILURE  The password could not be obtained.
   *
   * @note NS_MSG_PASSWORD_PROMPT_CANCELLED is a success code that is returned
   *       if the prompt was presented to the user but the user cancelled the
   *       prompt.
   */
	getPasswordWithUI: function _getPasswordWithUI(aPromptString, aPromptTitle, aMsgWindow)
	{
		if(!this.password) {
			this.getPasswordWithoutUI();
		}
		if(!this.password) {
			var dialog = aMsgWindow.authPrompt;
			var resPassword = {};
			if(!dialog.promptPassword(aPromptTitle, aPromptString, this.serverURI,
				dialog.SAVE_PASSWORD_PERMANENTLY, resPassword))
				this.password = "";
			else
				this.password = resPassword.value;
		}
		return this.password;
	},

	getLoginInfos: function() {
		var loginManager = mivExchangeMsgIncomingServer.loginManager;
		var currentUrl = PROTOCOL_NAME + "://" + this.hostName;
		return loginManager.findLogins({}, currentUrl, "", currentUrl);
	},

	//get password from the login manager
	getPasswordWithoutUI: function() {
		var logins = this.getLoginInfos();
		var serverUserName = this.username;
		var username;
		for(var i = 0; i < logins.length; ++i) {
			username = logins[i].username;
			if(username == serverUserName) {
				this.password =logins[i].password;
				break;
			}
		}
	},
  /* forget the password in memory and in single signon database */
	forgetPassword: function _forgetPassword() {
		var loginManager = mivExchangeMsgIncomingServer.loginManager;
		var logins = this.getLoginInfos();
		for(var i = 0; i < logins.length; ++i) {
			if(logins[i].username == this.username)
				loginManager.removeLogin(logins[i]);
		}
	},

  /* forget the password in memory which is cached for the session */
	forgetSessionPassword: function _forgetSessionPassword()
	{
		this.password = "";
	},

  /* should we download whole messages when biff goes off? */
	get downloadOnBiff()
	{
		return this.getBoolValue("download_on_biff");
	},

	set downloadOnBiff(aValue)
	{
		this.setBoolValue("download_on_biff", aValue);
	},

  /* should we biff the server? */
	get doBiff()
	{
		var hasBiff = this._prefBranch.prefHasUserValue("check_new_mail");
		if(hasBiff)
			return this._prefBranch.getBoolValue("check_new_mail");
		return this.getProtocolInfo().defaultDoBiff;
	},

	set doBiff(aValue)
	{
		this.setBoolValue("check_new_mail", aValue);
	},

  /* how often to biff */
	get biffMinutes()
	{
		return this.getIntValue("check_time");
	},

	set biffMinutes(aValue)
	{
		this.setIntValue("check_time", aValue);
	},

  /* current biff state */
	get biffState()
	{
		return this.getIntValue("biff_state");
	},

	set biffState(aValue)
	{
		this.setIntValue("biff_state", aValue);
	},

  /* are we running a url as a result of biff going off? (different from user clicking get msg) */
	get performingBiff()
	{
		return this.getBoolValue("performing_biff");
	},

	set performingBiff(aValue)
	{
		this.setBoolValue("performing_biff", aValue);
	},

  /* the on-disk path to message storage for this server */
	get localPath() {
    if(this._localPath) return this._localPath;
		var localPath = this.getFileValue("directory-rel", "directory");
		if(localPath) return localPath;

		var protocolInfo = this.getProtocolInfo();
		localPath = protocolInfo.defaultLocalPath.clone();
		//create the default local directory
		localPath.exists() || localPath.create(localPath.DIRECTORY_TYPE, 0755);
		//the hostname as sub directory
		localPath.append(this.hostName);
		localPath.createUnique(localPath.DIRECTORY_TYPE, 0755);
    serverLog.info('the server path is ' + localPath.path);

    this.localPath = localPath;
		return localPath;
	},

	set localPath(localPath) {
    this._localPath = localPath;
		// nsIFile stand for the file path, the create function will create the file or directory
		//if they have not exist
		localPath.exists() || localPath.create(localPath.DIRECTORY_TYPE, 0755);
		//save the file path into the preference
		this.setFileValue("directory-rel", "directory", localPath);
	},

  /*msgStore is used for create folder directory and find the directory*/
	get msgStore() {
		if(!this._msgStore) {
			var storeContractId = this.getCharValue("storeContractID");
			if(!storeContractId) {
				storeContractId = "@mozilla.org/msgstore/berkeleystore;1";
				this.setCharValue("storeContractID", storeContractId);
			}

			this._msgStore = Cc[storeContractId]
        .createInstance(Ci.nsIMsgPluggableStore);
      this._msgStore || serverLog.error('create msg store failed');
		}
		return this._msgStore;
	},

  /* the RDF URI for the root mail folder */
	get serverURI()
	{
		return PROTOCOL_NAME + "://" + this.username + "@" + this.hostName;
	},

  createLocalFolder: function(folderName) {
    var rootFolder = this.rootFolder;
    var child = rootFolder.getChildNamed(folderName);
    if(child)   return child;
    return this.msgStore.createFolder(rootFolder, folderName);
  },

	get rootFolder() {
		if(!this._rootFolder)
			this._rootFolder = this.createRootFolder();
		return this._rootFolder;
	},

	set rootFolder(rootFloder) {
		this._rootFolder = rootFloder;
	},

	createRootFolder: function() {
		var folder = Cc["@kingsoft.com/exchange-folder;1"]
      .createInstance(Ci.mivExchangeMsgFolder);
    folder || serverLog.error('cannot create root folder');
    folder.initWithIncomingServer(this.serverURI, this);
		return folder.QueryInterface(Ci.nsIMsgFolder);
	},
  /* root folder for this account
     - if account is deferred, root folder of deferred-to account */
	get rootMsgFolder()
	{
		if(!this._rootFolder)
			this._rootFolder = createRootFolder();
		return this._rootFolder;
	},

  /* are we already getting new Messages on the current server..
     This is used to help us prevent multiple get new msg commands from
     going off at the same time. */
	get serverBusy()
	{
		return this.getBoolValue("server_busy");
	},

	set serverBusy(aValue)
	{
		this.setBoolValue("server_busy", aValue);
	},

  /**
   * Is the server using a secure channel (SSL or STARTTLS).
   */
	get isSecure()
	{
		return true;
	},

  /**
   * Authentication mechanism.
   *
   * @see nsMsgAuthMethod (in MailNewsTypes2.idl)
   * Same as "mail.server...authMethod" pref
   */
	get authMethod()
	{
		return this.getIntValue("authMethod");
	},

	set authMethod(aValue)
	{
		this.setIntValue("authMethod", aValue);
	},

  /**
   * Whether to SSL or STARTTLS or not
   *
   * @see nsMsgSocketType (in MailNewsTypes2.idl)
   * Same as "mail.server...socketType" pref
   */
	get socketType()
	{
		var socketType = this.getIntValue("socketType");
		if(!socketType)
			return false;
		return true;
	},

	set socketType(aValue)
	{
		this.setIntValue("socketType", aValue);
	},

  /* empty trash on exit */
	get emptyTrashOnExit()
	{
		return this.getBoolValue("empty_trash_on_exit");
	},

	set emptyTrashOnExit(aValue)
	{
		this.setBoolValue("empty_trash_on_exit", aValue);
	},
  /**
   * Get the server's list of filters.
   *
   * This SHOULD be the same filter list as the root folder's, if the server
   * supports per-folder filters. Furthermore, this list SHOULD be used for all
   * incoming messages.
   *
   * Since the returned nsIMsgFilterList is mutable, it is not necessary to call
   * setFilterList after the filters have been changed.
   *
   * @param aMsgWindow  @ref msgwindow "The standard message window"
   * @return            The list of filters.
   */
	getFilterList: function _getFilterList(aMsgWindow)
	{
		if(!this._filterList) {
			var msgFolder = this.rootFolder;
			var filterType = this.getCharValue("filter.type");
			if(filterType === "default") {
				var contractId = "@mozilla.org/filterlist;1?type=" + filterType;
				this._filterList = Cc[contractId].createInstance(Ci.nsIMsgFilterList);
				this._filterList.folder = msgFolder;
				return this._filterList;
			}

			//judge if the msgFilterRules.dat exists
			var filterFilePath = mivExchangeMsgIncomingServer.createNewFile();
			filterFilePath.initWithFile(msgFolder.filePath);
			filterFilePath.append("msgFilterRules.dat");

			if(!filterFilePath.exists()) {
				//if not exists, then judge if the rules.dat exists or not
				var oldFilterFile = mivExchangeMsgIncomingServer.createNewFile();
				oldFilterFile.initWithFile(msgFolder.filePath);
				oldFilterFile.append("rules.dat");
				if(oldFilterFile.exists()) {
					//if rules.dat exists, then rename to msgFilterRules.dat
					oldFilterFile.copyto(msgFolder.filePath, "msgFilterRules.dat");
				}
			}
			var filterService = Cc["@mozilla.org/messenger/services/filters;1"]
				.getService(Ci.nsIMsgFilterService);
			this._filterList = filterService.OpenFilterList(filterFilePath, msgFolder, aMsgWindow);
		}
		return this._filterList;
	},

  /**
   * Set the server's list of filters.
   *
   * Note that this does not persist the filter list. To change the contents
   * of the existing filters, use getFilterList and mutate the values as
   * appopriate.
   *
   * @param aFilterList The new list of filters.
   */
	setFilterList: function _setFilterList(aFilterList)
	{
		this._filterList = aFilterList;
	},

  /**
   * Get user editable filter list. This does not have to be the same as
   * the filterlist above, typically depending on the users preferences.
   * The filters in this list are not processed, but only to be edited by
   * the user.
   * @see getFilterList
   *
   * @param aMsgWindow  @ref msgwindow "The standard message window"
   * @return            The list of filters.
   */
	getEditableFilterList: function _getEditableFilterList(aMsgWindow)
	{
		return this.getFilterList(aMsgWindow);
	},

  /**
   * Set user editable filter list.
   * This does not persist the filterlist, @see setFilterList
   * @see getEditableFilterList
   * @see setFilterList
   *
   * @param aFilterList The new list of filters.
   */
  //  void setEditableFilterList(in nsIMsgFilterList aFilterList);
	setEditableFilterList: function _setEditableFilterList(aFilterList)
	{
		dump("function setEditableFilterList\n");
	},

  /* we use this to set the default local path.  we use this when migrating prefs */
  //  void setDefaultLocalPath(in nsIFile aDefaultLocalPath);
	setDefaultLocalPath: function _setDefaultLocalPath(aDefaultLocalPath)
	{
		this.getProtocolInfo().defaultLocalPath = aDefaultLocalPath;
	},

  /**
   * Verify that we can logon
   *
   * @param  aUrlListener - gets called back with success or failure.
   * @param aMsgWindow         nsIMsgWindow to use for notification callbacks.
   * @return - the url that we run.
   */
  //  nsIURI verifyLogon(in nsIUrlListener aUrlListener, in nsIMsgWindow aMsgWindow);
	verifyLogon: function _verifyLogon(aUrlListener, aMsgWindow)
	{
		dump("function verifyLogon\n");
	},

  /* do a biff */
//  void performBiff(in nsIMsgWindow aMsgWindow);
	performBiff: function _performBiff(aMsgWindow)
	{
		dump("function performBiff\n");
	},

  /* get new messages */
//  void getNewMessages(in nsIMsgFolder aFolder, in nsIMsgWindow aMsgWindow,
//                      in nsIUrlListener aUrlListener);
	getNewMessages: function _getNewMessages(aFolder, aMsgWindow, aUrlListener)
	{
		aFolder.getNewMessages(aMsgWindow, aUrlListener);
	},

  /* this checks if a server needs a password to do biff */
//  readonly attribute boolean serverRequiresPasswordForBiff;
	get serverRequiresPasswordForBiff()
	{
		return true;
	},

  /* this gets called when the server is expanded in the folder pane */
//  void performExpand(in nsIMsgWindow aMsgWindow);
	performExpand: function _performExpand(aMsgWindow)
	{
		dump("function performExpand\n");
	},

  /* Write out all known folder data to panacea.dat */
//  void writeToFolderCache(in nsIMsgFolderCache folderCache);
	writeToFolderCache: function _writeToFolderCache(folderCache)
	{
		dump("function writeToFolderCache\n");
	},

  /* close any server connections */
//  void closeCachedConnections();
	closeCachedConnections: function _closeCachedConnections()
	{
		dump("function closeCachedConnections\n");
	},

  /* ... */
//  void shutdown();
	shutdown: function _shutdown()
	{
		dump("function shutdown\n");
	},

  /**
   * Get or set the value as determined by the preference tree.
   *
   * These methods MUST NOT fail if the preference is not set, and therefore
   * they MUST have a default value. This default value is provided in practice
   * by use of a default preference tree. The standard format for the pref
   * branches are <tt>mail.server.<i>key</i>.</tt> for per-server preferences,
   * such that the preference is <tt>mail.server.<i>key</i>.<i>attr</i></tt>.
   *
   * The attributes are passed in as strings for ease of access by the C++
   * consumers of this method.
   *
   * @param attr  The value for which the preference should be accessed.
   * @param value The value of the preference to set.
   * @return      The value of the preference.
   * @{
   */
//  boolean getBoolValue(in string attr);
	getBoolValue: function _getBoolValue(attr)
	{
		if(this._prefBranch.prefHasUserValue(attr))
			return this._prefBranch.getBoolPref(attr);
		return this._defaultPrefBranch.getBoolPref(attr);
	},

//  void setBoolValue(in string attr, in boolean value);
	setBoolValue: function _setBoolValue(attr, value)
	{
		this._prefBranch.setBoolPref(attr, value);
	},

//  ACString getCharValue(in string attr);
	getCharValue: function _getCharValue(attr)
	{
		if(this._prefBranch.prefHasUserValue(attr))
			return this._prefBranch.getCharPref(attr);
		return this._defaultPrefBranch.getCharPref(attr);
	},

//  void setCharValue(in string attr, in ACString value);
	setCharValue: function _setCharValue(attr, value)
	{
		this._prefBranch.setCharPref(attr, value);
	},

//  AString getUnicharValue(in string attr);
	getUnicharValue: function _getUnicharValue(attr)
	{
		if(this._prefBranch.prefHasUserValue(attr))
			return this._prefBranch.getComplexValue(attr, Ci.nsISupportsString).data;
		return this._defaultPrefBranch.getComplexValue(attr, Ci.nsISupportsString).data;
	},

//  void setUnicharValue(in string attr, in AString value);
	setUnicharValue: function _setUnicharValue(attr, value)
	{
		this._prefBranch.setComplexValue(attr, Ci.nsISupportsString, value);
	},

//  long getIntValue(in string attr);
	getIntValue: function _getIntValue(attr)
	{
		if(this._prefBranch.prefHasUserValue(attr))
			return this._prefBranch.getIntPref(attr);
		return this._defaultPrefBranch.getIntPref(attr);
	},

//  void setIntValue(in string attr, in long value);
	setIntValue: function _setIntValue(attr, value)
	{
		this._prefBranch.setIntPref(attr, value);
	},

  /** @} */

  /**
   * Get or set the value as determined by the preference tree.
   *
   * These methods MUST NOT fail if the preference is not set, and therefore
   * they MUST have a default value. This default value is provided in practice
   * by use of a default preference tree. The standard format for the pref
   * branches are <tt>mail.server.<i>key</i>.</tt> for per-server preferences,
   * such that the preference is <tt>mail.server.<i>key</i>.<i>attr</i></tt>.
   *
   * The attributes are passed in as strings for ease of access by the C++
   * consumers of this method.
   *
   * There are two preference names on here for legacy reasons, where the first
   * is the name which will be using a (preferred) relative preference and the
   * second a deprecated absolute preference. Implementations that do not have
   * to worry about supporting legacy preferences can safely ignore this second
   * parameter. Callers must still provide a valid value, though.
   *
   * @param relpref The name of the relative file preference.
   * @param absref  The name of the absolute file preference.
   * @param aValue  The value of the preference to set.
   * @return        The value of the preference.
   * @{
   */
//  nsIFile getFileValue(in string relpref, in string abspref);
	getFileValue: function _getFileValue(relpref, abspref)
	{
    var pref = this._prefBranch;
		var relFilePref = pref.prefHasUserValue(relpref) &&
      pref.getComplexValue(relpref, Ci.nsIRelativeFilePref);

		if(relFilePref) {
			var file = relFilePref.file;
			file.normalize();
			return file;
		}
		return null;
	},

//  void setFileValue(in string relpref, in string abspref, in nsIFile aValue);
	setFileValue: function _setFileValue(relpref, abspref, file)
	{
		var relFilePref = mivExchangeMsgIncomingServer
      .newRelativeFilePref(file, "ProfD");
		this._prefBranch.setComplexValue(relpref, Ci.nsIRelativeFilePref, relFilePref);
	},

  /** @} */

  /**
   * this is really dangerous. this destroys all pref values
   * do not call this unless you know what you're doing!
   */
//  void clearAllValues();
	clearAllValues: function _clearAllValues()
	{
		dump("function clearAllValues\n");
	},

  /**
   * this is also very dangerous.  this will remove the files
   * associated with this server on disk.
   */
//  void removeFiles();
	removeFiles: function _removeFiles()
	{
		dump("function removeFiles\n");
	},

//  attribute boolean valid;
	get valid()
	{
		return this.getBoolValue("valid");
	},

	set valid(aValue)
	{
		this.setBoolValue("value", aValue);
	},

//  AString toString();
	toString: function _toString()
	{
		dump("function toString\n");
	},

//  void displayOfflineMsg(in nsIMsgWindow aWindow);
	displayOfflineMsg: function _displayOfflineMsg(aWindow)
	{
		dump("function displayOfflineMsg\n");
	},

  /* used for comparing nsIMsgIncomingServers */
//  boolean equals(in nsIMsgIncomingServer server);
	equals: function _equals(server)
	{
		dump("function equals\n");
		return false;
	},

  /* Get Messages at startup */
//  readonly attribute boolean downloadMessagesAtStartup;
	get downloadMessagesAtStartup()
	{
		dump("get downloadMessagesAtStartup\n");
		return true;
	},

  /* check to this if the server supports filters */
//  attribute boolean canHaveFilters;
	get canHaveFilters()
	{
		dump("get canHaveFilters\n");
		return false;
	},

	set canHaveFilters(aValue)
	{
		dump("set canHaveFilters aValue:"+aValue+"\n");
	},

  /**
   * can this server be removed from the account manager?  for
   * instance, local mail is not removable, but an imported folder is
   */
//  attribute boolean canDelete;
	get canDelete()
	{
		return this.getBoolValue("can_delete");
	},

	set canDelete(aValue)
	{
		this.setBoolValue("can_delete", aValue);
	},

//  attribute boolean loginAtStartUp;
	get loginAtStartUp()
	{
		var loginAtStartup = this.getBoolValue("login_at_startup");
		if(loginAtStartup)
			return loginAtStartup;
		return false;
	},

	set loginAtStartUp(aValue)
	{
		this.setBoolValue("login_at_startup", aValue);
	},

//  attribute boolean limitOfflineMessageSize;
	get limitOfflineMessageSize()
	{
		return this.getBoolValue("limit_offline_message_size");
	},

	set limitOfflineMessageSize(aValue)
	{
		this.setBoolValue("limit_offline_message_size", aValue);
	},
//  attribute long maxMessageSize;
	get maxMessageSize()
	{
		return this.getIntValue("max_size");
	},

	set maxMessageSize(aValue)
	{
		this.setIntValue("max_size", aValue);
	},

//  attribute nsIMsgRetentionSettings retentionSettings;
	get retentionSettings()
	{
		dump("get retentionSettings\n");
		return false;
	},

	set retentionSettings(aValue)
	{
		dump("set retentionSettings aValue:"+aValue+"\n");
	},

  /* check if this server can be a default server */
//  readonly attribute boolean canBeDefaultServer;
	get canBeDefaultServer()
	{
		return false;
		dump("get canBeDefaultServer\n");
	},

  /* check if this server allows search operations */
//  readonly attribute boolean canSearchMessages;
	get canSearchMessages()
	{
		return false;
		dump("get canSearchMessages\n");
	},

  /* check if this server allows canEmptyTrashOnExit operations */
//  readonly attribute boolean canEmptyTrashOnExit;
	get canEmptyTrashOnExit()
	{
		dump("get canEmptyTrashOnExit\n");
		return false;
	},

  /* display startup page once per account per session */
//  attribute boolean displayStartupPage;
	get displayStartupPage()
	{
		dump("get displayStartupPage\n");
		return false;
	},

	set displayStartupPage(aValue)
	{
		dump("set displayStartupPage aValue:"+aValue+"\n")
	},
//  attribute nsIMsgDownloadSettings downloadSettings;
	get downloadSettings()
	{
		dump("get downloadSettings\n");
		return false;
	},

	set downloadSettings(aValue)
	{
		dump("set downloadSettings aValue:"+aValue+"\n");
	},

  /*
   * Offline support level. Support level can vary based on abilities
   * and features each server can offer wrt to offline service.
   * Here is the legend to determine the each support level details
   *
   * supportLevel == 0  --> no offline support (default)
   * supportLevel == 10 --> regular offline feature support
   * supportLevel == 20 --> extended offline feature support
   *
   * Each server can initialize itself to the support level if needed
   * to override the default choice i.e., no offline support.
   *
   * POP3, None and Movemail will default to 0.
   * IMAP level 10 and NEWS with level 20.
   *
   */
//  attribute long offlineSupportLevel;
	get offlineSupportLevel()
	{
		return 10;
		dump("get offlineSupportLevel\n");
	},

	set offlineSupportLevel(aValue)
	{
		dump("set offlineSupportLevel aValue:"+aValue+"\n");
	},

  /* create pretty name for migrated accounts */
//  AString generatePrettyNameForMigration();
	generatePrettyNameForMigration: function _generatePrettyNameForMigration()
	{
		return this.prettyName;
		dump("function generatePrettyNameForMigration\n");
	},

  /* does this server have disk space settings? */
//  readonly attribute boolean supportsDiskSpace;
	get supportsDiskSpace()
	{
		return false;
		dump("get supportsDiskSpace\n");
	},

  /**
   * Hide this server/account from the UI - used for smart mailboxes.
   * The server can be retrieved from the account manager by name using the
   * various Find methods, but nsIMsgAccountManager's GetAccounts and
   * GetAllServers methods won't return the server/account.
   */
//  attribute boolean hidden;
	get hidden()
	{
		return this.getBoolValue("hidden");
	},

	set hidden(aValue)
	{
		this.setBoolValue("hidden", aValue);
	},

  /**
   * If the server supports Fcc/Sent/etc, default prefs can point to
   * the server. Otherwise, copies and folders prefs should point to
   * Local Folders.
   *
   * By default this value is set to true via global pref 'allows_specialfolders_usage'
   * (mailnews.js). For Nntp, the value is overridden to be false.
   * If ISPs want to modify this value, they should do that in their rdf file
   * by using this attribute. Please look at mozilla/mailnews/base/ispdata/aol.rdf for
   * usage example.
   */
//  attribute boolean defaultCopiesAndFoldersPrefsToServer;
	get defaultCopiesAndFoldersPrefsToServer()
	{
		return this.getBoolValue("allows_specialfolders_usage");
	},

	set defaultCopiesAndFoldersPrefsToServer(aValue)
	{
		this.setBoolValue("allows_specialfolders_usage", aValue);
	},

  /* can this server allows sub folder creation */
//  attribute boolean canCreateFoldersOnServer;
	get canCreateFoldersOnServer()
	{
		return this.getBoolValue("can_create_folders_onserver");
	},

	set canCreateFoldersOnServer(aValue)
	{
		this.setBoolValue("can_create_folders_onserver", aValue);
	},

  /* can this server allows message filing ? */
//  attribute boolean canFileMessagesOnServer;
	get canFileMessagesOnServer()
	{
		return this.getBoolValue("can_file_messages");
	},

	set canFileMessagesOnServer(aValue)
	{
		this.setBoolValue("can_file_messages", aValue);
	},

  /* can this server allow compacting folders ? */
//  readonly attribute boolean canCompactFoldersOnServer;
	get canCompactFoldersOnServer()
	{
		return false;
		dump("get canCompactFoldersOnServer\n");
	},

  /* can this server allow undo delete ? */
//  readonly attribute boolean canUndoDeleteOnServer;
	get canUndoDeleteOnServer()
	{
		return false;
		dump("get canUndoDeleteOnServer\n");
	},

  /* used for setting up the filter UI */
//  readonly attribute nsMsgSearchScopeValue filterScope;
	get filterScope()
	{
		dump("get filterScope\n");
	},

  /* used for setting up the search UI */
//  readonly attribute nsMsgSearchScopeValue searchScope;
	get searchScope()
	{
		return null;
		dump("get searchScope\n");
	},

  /**
   * If the password for the server is available either via authentication
   * in the current session or from password manager stored entries, return
   * false. Otherwise, return true. If password is obtained from password
   * manager, set the password member variable.
   */
//  readonly attribute boolean passwordPromptRequired;
	get passwordPromptRequired()
	{
		return true;
	},

  /**
   * for mail, this configures both the MDN filter, and the server-side
   * spam filter filters, if needed.
   *
   * If we have set up to filter return receipts into
   * our Sent folder, this utility method creates
   * a filter to do that, and adds it to our filterList
   * if it doesn't exist.  If it does, it will enable it.
   *
   * this is not used by news filters (yet).
   */
//  void configureTemporaryFilters(in nsIMsgFilterList filterList);
	configureTemporaryFilters: function _configureTemporaryFilters(filterList)
	{
		dump("function configureTemporaryFilters\n");
	},

  /**
   * If Sent folder pref is changed we need to clear the temporary
   * return receipt filter so that the new return receipt filter can
   * be recreated (by ConfigureTemporaryReturnReceiptsFilter()).
   */
//  void clearTemporaryReturnReceiptsFilter();
	clearTemporaryReturnReceiptsFilter: function _clearTemporaryReturnReceiptsFilter()
	{
		dump("function clearTemporaryReturnReceiptsFilter\n");
	},

  /**
   * spam settings
   */
//  readonly attribute nsISpamSettings spamSettings;
	get spamSettings()
	{
		dump("get spamSettings\n");
	},

//  readonly attribute nsIMsgFilterPlugin spamFilterPlugin;
	get spamFilterPlugin()
	{
		return null;
		dump("get spamFilterPlugin\n");
	},

//  nsIMsgFolder getMsgFolderFromURI(in nsIMsgFolder aFolderResource, in ACString aURI);
	getMsgFolderFromURI: function _getMsgFolderFromURI(aFolderResource, aURI)
	{
		var rootMsgFolder = this.rootMsgFolder;
		return rootMsgFolder.getChildWithURI(aURI, true, true);
	},

//  readonly attribute boolean isDeferredTo;
	get isDeferredTo()
	{
		return false;
		dump("get isDeferredTo\n");
	},

//  const long keepDups = 0;
//  const long deleteDups = 1;
//  const long moveDupsToTrash = 2;
//  const long markDupsRead = 3;

//  attribute long incomingDuplicateAction;
	get incomingDuplicateAction()
	{
		return this.getIntValue("dup_action");
	},

	set incomingDuplicateAction(aValue)
	{
		this.setIntValue("dup_action", aValue);
	},

  // check if new hdr is a duplicate of a recently arrived header
//  boolean isNewHdrDuplicate(in nsIMsgDBHdr aNewHdr);
	isNewHdrDuplicate: function _isNewHdrDuplicate(aNewHdr)
	{
		dump("function isNewHdrDuplicate\n");
		return false;
	},

  /**
   * Set a boolean to force an inherited propertyName to return empty instead
   * of inheriting from a parent folder, server, or the global
   *
   * @param propertyName         The name of the property
   * @param aForcePropertyEmpty  true if an empty inherited property should be returned
   */
//  void setForcePropertyEmpty(in string propertyName, in boolean aForcePropertyEmpty);
	setForcePropertyEmpty: function _setForcePropertyEmpty(propertyName, aForcePropertyEmpty)
	{
		dump("function setForcePropertyEmpty\n");
	},

  /**
   * Get a boolean to force an inherited propertyName to return empty instead
   * of inheriting from a parent folder, server, or the global
   *
   * @param propertyName      The name of the property
   *
   * @return                  true if an empty inherited property should be returned
   */
//  boolean getForcePropertyEmpty(in string propertyName);
	getForcePropertyEmpty: function _getForcePropertyEmpty(propertyName)
	{
		dump("function getForcePropertyEmpty\n");
		return false;
	},

  /**
   * Return the order in which this server type should appear in the folder pane.
   * This sort order is a number between 100000000 and 900000000 so that RDF can
   * use it as a string.
   * The current return values are these:
   * 0 = default account,       100000000 = mail accounts (POP3/IMAP4),
   * 200000000 = Local Folders, 300000000 = IM accounts,
   * 400000000 = RSS,           500000000 = News
   * If a new server type is created a TB UI reviewer must decide its sort order.
   */
//  readonly attribute long sortOrder;
	get sortOrder()
	{
		dump("get sortOrder\n");
		return 100000000;
	},


};


var components = [mivExchangeMsgIncomingServer];
if ("generateNSGetFactory" in XPCOMUtils)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);  // Firefox 4.0 and higher
else
  var NSGetModule = XPCOMUtils.generateNSGetModule(components);    // Firefox 3.x
