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
 * Author: Michel Verbraak (info@1st-setup.nl)
 * Website: http://www.1st-setup.nl/
 *
 * This interface/service is used for loadBalancing Request to Exchange
 *
 * ***** BEGIN LICENSE BLOCK *****/

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/mailServices.js");
Cu.import("resource://exchangeEws/commonFunctions.js");

Cu.import('resource:///modules/mailServices.js');

var folderLog = commonFunctions.Log.getInfoLevelLogger('exchange-folder');

var EXPORTED_SYMBOLS = ["mivExchangeMsgFolder"];


function createSimpleEnumerator(aArray) {
  return {
    _i: 0,
    hasMoreElements: function() {
      return this._i < aArray.length;
    },
    getNext: function() {
      return aArray[this._i++];
    }
  };
}

function FolderAtomList() {
  var atomService = Cc['@mozilla.org/atom-service;1']
    .getService(Ci.nsIAtomService);
  this.folderFlag = atomService.getAtom('FolderFlag');
  this.synchronizeAtom = atomService.getAtom('Synchronize');
  this.openAtom = atomService.getAtom('open');
}
var folderAtomList = new FolderAtomList;

/*listener manager used for send the folder notification*/
function getListenerManager() {
  return MailServices.mailSession.QueryInterface(Ci.nsIFolderListener);
}
var listenerManager = getListenerManager();

function mivExchangeMsgFolder() {

	//this.logInfo("mivExchangeMsgFolder: init");
 	this._uri = null;
	this._baseMessageUri = null;
	this._database = null;
	this._name = null;
	this._server = null;	//nsIMsgIncomingServer
	this._path = null;		//nsIFile: file path
	this._flags = null;
	this._parent = null;
	this._subfolders = [];

  this._username = null;
  this._hostname = null;

  this._listeners = [];
}

mivExchangeMsgFolder.EXCHANGE_SCHEMA = "exchange:/";
mivExchangeMsgFolder.EXCHANGE_MESSAGE_SCHEMA = "exchange-message:/";
mivExchangeMsgFolder.INCOMING_SERVER_TYPE = "exchange";

mivExchangeMsgFolder.createLocalFile = function(filePath) {
	var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
	file.initWithFile(filePath);
	return file;
}

var mivExchangeMsgFolderGUID = "364ed353-d3ad-41d2-9df3-2fab209d9ac1";

mivExchangeMsgFolder.prototype = {

  /*	QueryInterface : XPCOMUtils.generateQI([Ci.mivExchangeMsgFolder,
  				Ci.nsIMsgFolder,
  				Ci.nsIClassInfo,
  				Ci.nsISupports]),
  */
	QueryInterface : XPCOMUtils.generateQI([Ci.mivExchangeMsgFolder,
				Ci.nsIRDFResource,
				Ci.nsIMsgFolder,
				Ci.nsISupports]),

	_className : "mivExchangeMsgFolder",

	classDescription : "Exchange EWS Msg Folder",

	classID : components.ID("{"+mivExchangeMsgFolderGUID+"}"),
	contractID : "@kingsoft.com/exchange/msgfolder;1",
  //	flags : Ci.nsIClassInfo.THREADSAFE,
	implementationLanguage : Ci.nsIProgrammingLanguage.JAVASCRIPT,

	// nsISupports getHelperForLanguage(in PRUint32 language);
	getHelperForLanguage: function _getHelperForLanguage(language) {
		return null;
	},

	getInterfaces : function _getInterfaces(count) {
		var ifaces = [Ci.mivExchangeMsgFolder,
				Ci.nsIRDFResource,
				Ci.nsIMsgFolder,
				Ci.nsISupports];
		count.value = ifaces.length;
		return ifaces;
	},

  initWithIncomingServer: function(baseUri, server) {
    this._uri = baseUri;
    this._server = server;
    this.parseUri();
    this._baseMessageUri = generateBaseMessageUri();
    folderLog.info('init successfully');

    function generateBaseMessageUri() {
      var biasIndex = baseUri.indexOf('/');
      if(biasIndex === -1)
        throw new Error("server URI isnot correct");
      return mivExchangeMsgFolder.EXCHANGE_MESSAGE_SCHEMA
        + baseUri.slice(biasIndex + 1);
    }
  },

	parseUri: function() {
		var url = Cc["@mozilla.org/network/standard-url;1"]
      .createInstance(Ci.nsIURL);
		url.spec = this._uri;
		//parse isServer from the uri
		this._isServer = (url.path === "/");
		//parse name from the uri
		if(!this._name) {
			this._name = url.fileName;
		}
    this._username = url.username;
    this._hostname = url.host;
		//parse the local path from the uri
		if(!this._server) return ;

    var localPath = this._server.localPath.clone();
		localPath.append(url.fileName);
    this._path = localPath;
    folderLog.info('the file path is: ' + localPath.path + ' is server: ' +
      this._isServer);

    var self = this;
    function createRootDirectory() {
      //create root folder
      if(self._isServer && !localPath.exists())
        localPath.create(localPath.DIRECTORY_TYPE, 0755);
    }
    createRootDirectory();
 	},
  //  const nsMsgBiffState nsMsgBiffState_NewMail = 0; // User has new mail waiting.
  //  const nsMsgBiffState nsMsgBiffState_NoMail =  1; // No new mail is waiting.
  //  const nsMsgBiffState nsMsgBiffState_Unknown = 2; // We dunno whether there is new mail.

    /// Returns an enumerator containing the messages within the current database.
  //  readonly attribute nsISimpleEnumerator messages;
	get messages() {
		if(this.database)
			return this.database.enumerateMessages();
		return null;
	},

  //  void startFolderLoading();
	startFolderLoading: function _startFolderLoading()
	{
	},

  //  void endFolderLoading();
	endFolderLoading: function _endFolderLoading()
	{
	},

  /* get new headers for db */
  //  void updateFolder(in nsIMsgWindow aWindow);
	updateFolder: function _updateFolder(aWindow)
	{
	},

  //  readonly attribute AString prettiestName;
	get prettiestName() {
		return this.name;
	},

  /**
   * URL for this folder
   */
  //  readonly attribute ACString folderURL;
	get folderURL()
	{
		return true;
	},

  /**
   * should probably move to the server
   */
  //  readonly attribute boolean showDeletedMessages;
	get showDeletedMessages()
	{
		return true;
	},

  /**
   * this folder's parent server
   */
  //  readonly attribute nsIMsgIncomingServer server;
	get server() {
		return this._server;
	},

  /**
   * is this folder the "phantom" server folder?
   */
  //  readonly attribute boolean isServer;
	get isServer() {
		return this._isServer;
	},

  //  readonly attribute boolean canSubscribe;
	get canSubscribe()
	{
		return true;
	},

  //  readonly attribute boolean canFileMessages;
	get canFileMessages()
	{
		return true;
	},

  //  readonly attribute boolean noSelect;  // this is an imap no select folder
	get noSelect()
	{
		return true;
	},

  //  readonly attribute boolean imapShared; // this is an imap shared folder
	get imapShared()
	{
		return true;
	},

  //  readonly attribute boolean canDeleteMessages; // can't delete from imap read-only
	get canDeleteMessages()
	{
		return true;
	},

  /**
   * does this folder allow subfolders?
   * for example, newsgroups cannot have subfolders, and the INBOX
   * on some IMAP servers cannot have subfolders
   */
  //  readonly attribute boolean canCreateSubfolders;
	get canCreateSubfolders()
	{
		return true;
	},

  /**
   * can you change the name of this folder?
   * for example, newsgroups
   * and some special folders can't be renamed
   */
  //  readonly attribute boolean canRename;
	get canRename()
	{
		return true;
	},

  //  readonly attribute boolean canCompact;
	get canCompact()
	{
		return true;
	},

  /**
   * the phantom server folder
   */
  //  readonly attribute nsIMsgFolder rootFolder;
	get rootFolder() {
		return this.server.rootFolder;
	},

  /**
   * Get the server's list of filters. (Or in the case of news, the
   * filter list for this newsgroup)
   * This list SHOULD be used for all incoming messages.
   *
   * Since the returned nsIMsgFilterList is mutable, it is not necessary to call
   * setFilterList after the filters have been changed.
   *
   * @param aMsgWindow  @ref msgwindow "The standard message window"
   * @return            The list of filters
   */
  //  nsIMsgFilterList getFilterList(in nsIMsgWindow msgWindow);
	getFilterList: function _getFilterList(msgWindow)
	{
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
  //  void setFilterList(in nsIMsgFilterList filterList);
	setFilterList: function _setFilterList(filterList)
	{
	},

  /**
   * Get user editable filter list. This does not have to be the same as
   * the filterlist above, typically depending on the users preferences.
   * The filters in this list are not processed, but only to be edited by
   * the user.
   * @see getFilterList
   *
   * @param aMsgWindow  @ref msgwindow "The standard message window"
   * @return            The list of filters
   */
  //  nsIMsgFilterList getEditableFilterList(in nsIMsgWindow aMsgWindow);
	getEditableFilterList: function _getEditableFilterList(aMsgWindow)
	{
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
	},

  //  void ForceDBClosed ();
	ForceDBClosed: function _ForceDBClosed()
	{
	},
  /**
   * Close and backup a folder database prior to reparsing
   *
   * @param  newName  New name of the corresponding message folder.
   *                  Used in rename to set the file name to match the renamed
   *                  folder. Set to empty to use the existing folder name.
   */
  //  void closeAndBackupFolderDB(in ACString newName);
	closeAndBackupFolderDB: function _closeAndBackupFolderDB(newName)
	{
	},

  //  void Delete ();
	Delete: function _Delete()
	{
	},

  //  void deleteSubFolders(in nsIArray folders, in nsIMsgWindow msgWindow);
	deleteSubFolders: function _deleteSubFolders(folders, msgWindow)
	{
	},

  //  void propagateDelete(in nsIMsgFolder folder, in boolean deleteStorage,
  //                       in nsIMsgWindow msgWindow);
	propagateDelete: function _propagateDelete(folder, deleteStorage, msgWindow)
	{
	},

  //  void recursiveDelete(in boolean deleteStorage, in nsIMsgWindow msgWindow);
	recursiveDelete: function _recursiveDelete(deleteStorage, msgWindow)
	{
	},

  /**
   * Adds the subfolder with the passed name to the folder hierarchy.
   * This is used internally during folder discovery; It shouldn't be
   * used to create folders since it won't create storage for the folder,
   * especially for imap. Unless you know exactly what you're doing, you
   * should be using createSubfolder + getChildNamed or createLocalSubfolder.
   *
   * @param aFolderName Name of the folder to add.
   * @returns The folder added.
   */
	addSubfolder: function(aFolderName) {
    folderLog.info('addSubfolder folder name is ' + aFolderName);
    var newFolder = new mivExchangeMsgFolder;
    var newUri = this._uri;
    /\/$/.test(newUri) || (newUri += '\/');
    newFolder.initWithIncomingServer( newUri + aFolderName, this.server);
    newFolder.parent = this;

    this._subfolders.push(newFolder);
    return newFolder;
	},

  /* this method ensures the storage for the folder exists.
    For local folders, it creates the berkeley mailbox if missing.
    For imap folders, it subscribes to the folder if it exists,
    or creates it if it doesn't exist
  */
  //  void createStorageIfMissing(in nsIUrlListener urlListener);
	createStorageIfMissing: function _createStorageIfMissing(urlListener)
	{
	},

  /**
   * Compact this folder. For IMAP folders configured for offline use,
   * it will also compact the offline store, and the completed notification
   * will occur when the Expunge is finished, not the offline store compaction.
   *
   * @param aListener   Notified of completion, can be null.
   * @param aMsgWindow  For progress/status, can be null.
   */
  //  void compact(in nsIUrlListener aListener, in nsIMsgWindow aMsgWindow);
	compact: function _compact(aListener, aMsgWindow)
	{
	},

  /**
   * Compact all folders in the account corresponding to this folder/
   * Optionally compact their offline stores as well (imap/news)
   *
   * @param aListener   Notified of completion, can be null.
   * @param aMsgWindow  For progress/status, can be null.
   * @param aCompactOfflineAlso  This controls whether we compact all
   *                             offline stores as well.
   */
  //  void compactAll(in nsIUrlListener aListener, in nsIMsgWindow aMsgWindow,
  //                  in boolean aCompactOfflineAlso);
	compactAll: function _compactAll(aListener, aMsgWindow, aCompactOfflineAlso)
	{
	},

  //  void compactAllOfflineStores(in nsIUrlListener aListener,
  //                               in nsIMsgWindow aMsgWindow,
  //                               in nsIArray aOfflineFolderArray);
	compactAllOfflineStores: function _compactAllOfflineStores(aListener, aMsgWindow, aOfflineFolderArray)
	{
	},

  //  void emptyTrash(in nsIMsgWindow aMsgWindow, in nsIUrlListener aListener);
	emptyTrash: function _emptyTrash(aMsgWindow, aListener)
	{
	},

  /**
   * change the name of the folder
   *
   * @param name the new name of the folder
   */
  //  void rename(in AString name, in nsIMsgWindow msgWindow);
	rename: function _rename(name, msgWindow)
	{
	},

  //  void renameSubFolders( in nsIMsgWindow msgWindow, in nsIMsgFolder oldFolder);
	renameSubFolders: function _renameSubFolders(msgWindow, oldFolder)
	{
	},

  //  AString generateUniqueSubfolderName(in AString prefix,
  //                                      in nsIMsgFolder otherFolder);
	generateUniqueSubfolderName: function _generateUniqueSubfolderName(prefix, otherFolder)
	{
	},

  //  void updateSummaryTotals(in boolean force);
	updateSummaryTotals: function _updateSummaryTotals(force)
	{
	},

  //  void summaryChanged();
	summaryChanged: function _summaryChanged()
	{
	},

  /**
   * get the total number of unread messages in this folder,
   * or in all subfolders
   *
   * @param deep if true, descends into all subfolders and gets a grand total
   */
  //  long getNumUnread(in boolean deep);
	getNumUnread: function _getNumUnread(deep)
	{
	},

  /**
   * get the total number of messages in this folder,
   * or in all subfolders
   *
   * @param deep if true, descends into all subfolders and gets a grand total
   */
  //  long getTotalMessages(in boolean deep);
	getTotalMessages: function _getTotalMessages(deep)
	{
	},

 /**
  * does this folder have new messages
  *
  */
  //  attribute boolean hasNewMessages;
	get hasNewMessages()
	{
		return true;
	},

	set hasNewMessages(aValue)
	{
	},

  /**
   * return the first new message in the folder
   *
   */
  //  readonly attribute nsIMsgDBHdr firstNewMessage;
	get firstNewMessage()
	{
		return true;
	},

  /**
   * clear new status flag of all of the new messages
   */
  //  void clearNewMessages();
	clearNewMessages: function _clearNewMessages()
	{
	},

  //  readonly attribute unsigned long expungedBytes;
	get expungedBytes()
	{
		return true;
	},

  /**
   * Can this folder be deleted?
   * For example, special folders and isServer folders cannot be deleted.
   */
  //  readonly attribute boolean deletable;
	get deletable()
	{
		return true;
	},

  /**
   * should we be displaying recipients instead of the sender?
   * for example, in the Sent folder, recipients are more relevant
   * than the sender
   */
  //  readonly attribute boolean displayRecipients;
	get displayRecipients()
	{
		return true;
	},

  /**
   * used to determine if it will take a long time to download all
   * the headers in this folder - so that we can do folder notifications
   * synchronously instead of asynchronously
   */
  //  readonly attribute boolean manyHeadersToDownload;
	get manyHeadersToDownload()
	{
		return true;
	},

  //  readonly attribute boolean requiresCleanup;
	get requiresCleanup()
	{
		return true;
	},

  //  void clearRequiresCleanup();
	clearRequiresCleanup: function _clearRequiresCleanup()
	{
	},

  /**
   * this should go into a news-specific interface
   */
  //  readonly attribute boolean knowsSearchNntpExtension;
	get knowsSearchNntpExtension()
	{
		return true;
	},

  /**
   * this should go into a news-specific interface
   */
  //  readonly attribute boolean allowsPosting;
	get allowsPosting()
	{
		return true;
	},

  //  readonly attribute ACString relativePathName;
	get relativePathName()
	{
		return true;
	},

  /**
   * size of this folder on disk (not including .msf file)
   * for imap, it's the sum of the size of the messages
   */
  //  attribute unsigned long sizeOnDisk;
	get sizeOnDisk()
	{
		return true;
	},

	set sizeOnDisk(aValue)
	{
	},

	get username() {
		return this._username;
	},
	get hostname() {
		return this._hostname;
	},

  /**
   * void setFlag(in unsigned long flag);
   * Sets a flag on the folder. The known flags are defined in
   * nsMsgFolderFlags.h.
   *
   * @param flag  The flag to set on the folder.
   */
	setFlag: function(flag) {
    this._flags |= flag;
    this.onFlagChange(flag);
	},

  /**
   * Clears a flag on the folder. The known flags are defined in
   * nsMsgFolderFlags.h.
   *
   * @param flag  The flag to clear on the folder.
   */
  //  void clearFlag(in unsigned long flag);
	clearFlag: function(flag) {
    this._flags &= ~flag;
    this.onFlagChange(flag);
	},

  /**
   * boolean getFlag(in unsigned long flag);
   * Determines if a flag is set on the folder or not. The known flags are
   * defined in nsMsgFolderFlags.h.
   *
   * @param flag  The flag to check on the folder.
   * @return      True if the flag exists.
   */
	getFlag: function(flag) {
    return this._flags & flag;
	},

  /**
   * Toggles a flag on the folder. The known flags are defined in
   * nsMsgFolderFlags.h.
   *
   * @param flag  The flag to toggle
   */
	toggleFlag: function(flag) {
    this._flags ^= flag;
    this.onFlagChange(flag);
	},

  /**
   * Called to notify the database and/or listeners of a change of flag. The
   * known flags are defined in nsMsgFolderFlags.h
   *
   * @note        This doesn't need to be called for normal flag changes via
   *              the *Flag functions on this interface.
   *
   * @param flag  The flag that was changed.
   */
	onFlagChange: function(changeFlags) {
    var db =  this.getDBFolderInfoAndDB();
    var folderFlag = this._flags;
    if(db) {
      db.dBFolderInfo.flags = folderFlag;
      db.Commit(Ci.nsMsgDBCommitType.kLargeCommit);
    }

    var oldFlag = folderFlag | changeFlags; //changeFlags used for clear
    if(folderFlag & changeFlags)
      oldFlag = folderFlag & ~changeFlags;  //changeFlags to add the flag
    this.NotifyIntPropertyChanged(folderAtomList.folderFlag,
      oldFlag, folderFlag);

    var newValue;
    if(newValue = (changeFlags & Ci.nsMsgFolderFlags.Offline)) {
      this.NotifyBoolPropertyChanged(folderAtomList.synchronizeAtom, !newValue,
        newValue);
    }
    else if(newValue = (changeFlags & Ci.nsMsgFolderFlags.Elided)) {
      this.NotifyBoolPropertyChanged(folderAtomList.openAtom, newValue,
        !newValue);
    }
	},


  /**
   * attribute unsigned long flags;
   * Direct access to the set/get all the flags at once.
   */
	get flags() {
		return this._flags;
	},

	set flags(flags) {
    if(this._flags === flags) return;
    var changeFlags = this._flags ^ flags;
    this._flags = flags;
    folderLog.info('flags set complete, begin to notify');
    this.onFlagChange(changeFlags);
	},

  /**
   * nsIMsgFolder getFolderWithFlags(in unsigned long flags);
   *
   * Gets the first folder that has the specified flags set.
   *
   * @param flags    The flag(s) to check for.
   * @return         The folder or the first available child folder that has
   *                 the specified flags set, or null if there are none.
   */
	getFolderWithFlags: function(flags) {
    folderLog.info('the folder flags is ' + this._flags + ', the flags is ' +
      flags);
    if( (this._flags & flags) === flags) return this;
    var subFolders = this._subfolders;
    var length = subFolders.length;
    for(var i = 0; i < length; ++i) {
      var folder = subFolders[i].getFolderWithFlags(flags);
      if(folder)  return folder;
    }
    return null;
	},

  /**
   * nsIArray getFoldersWithFlags(in unsigned long flags);
   * Gets the folders that have the specified flag set.
   *
   * @param flags    The flag(s) to check for.
   * @return         An array of folders that have the specified flags set.
   *                 The array may have zero elements.
   */
	getFoldersWithFlags: function(flags) {
    var folders = [];
    if( (this._flags & flags) === flags) folders.push(this);
    this._subfolders.forEach( function(subfolder) {
      folders = folders.concat(subfolder.getFoldersWithFlags(flags));
    });
    return folders;
	},

  /**
   * void listFoldersWithFlags(in unsigned long flags,
                           in nsIMutableArray folders);
   * Lists the folders that have the specified flag set.
   *
   * @param flags    The flag(s) to check for.
   * @param folders  The array in which to append the found folder(s).
   */
	listFoldersWithFlags: function(flags, folders) {
    var folderList = getFoldersWithFlags(flags);
    folderList.forEach(function(folder) {
      folders.appendElement(folder, false);
    });
	},

  /**
   * boolean isSpecialFolder(in unsigned long flags,
                           [optional] in boolean checkAncestors);
   * Check if this folder (or one of its ancestors) is special.
   *
   * @param flags          The "special" flags to check.
   * @param checkAncestors Should ancestors be checked too.
   */
  isSpecialFolder: function(flags, checkAncestors) {
    return false;
	},

  //  ACString getUriForMsg(in nsIMsgDBHdr msgHdr);
	getUriForMsg: function(msgHdr) {
    return this.baseMessageURI + '#' + msgHdr.messageKey;
	},

  /**
   * Deletes the messages from the folder.
   *
   * @param messages      The array of nsIMsgDBHdr objects to be deleted.
   * @param msgWindow     The standard message window object, for alerts et al.
   * @param deleteStorage Whether or not the message should be truly deleted, as
                          opposed to moving to trash.
   * @param isMove        Whether or not this is a deletion for moving messages.
   * @param allowUndo     Whether this action should be undoable.
   */
  //  void deleteMessages(in nsIArray messages,
  //                      in nsIMsgWindow msgWindow,
  //                      in boolean deleteStorage, in boolean isMove,
  //                      in nsIMsgCopyServiceListener listener, in boolean allowUndo);
	deleteMessages: function _deleteMessages(messages, msgWindow, deleteStorage, isMove, listener, allowUndo)
	{
	},

  //  void copyMessages(in nsIMsgFolder srcFolder, in nsIArray messages,
  //                    in boolean isMove, in nsIMsgWindow msgWindow,
  //                    in nsIMsgCopyServiceListener listener, in boolean isFolder,
  //                    in boolean allowUndo);
	copyMessages: function _copyMessages(srcFolder, messages, isMove, msgWindow, listener, isFolder, allowUndo)
	{
	},

  //  void copyFolder(in nsIMsgFolder srcFolder, in boolean isMoveFolder,
  //                  in nsIMsgWindow msgWindow, in nsIMsgCopyServiceListener listener );
	copyFolder: function _copyFolder(srcFolder, isMoveFolder, msgWindow, listener)
	{
	},

  //  void copyFileMessage(in nsIFile file, in nsIMsgDBHdr msgToReplace,
  //                       in boolean isDraft, in unsigned long newMsgFlags,
  //                       in ACString aKeywords,
  //                       in nsIMsgWindow msgWindow,
  //                       in nsIMsgCopyServiceListener listener);
	copyFileMessage: function _copyFileMessage(file, msgToReplace, isDraft, newMsgFlags, aKeywords,
                                                    msgWindow, listener)
	{
	},

  //  void acquireSemaphore (in nsISupports semHolder);
	acquireSemaphore: function _acquireSemaphore(semHolder)
	{
	},

  //  void releaseSemaphore (in nsISupports semHolder);
	releaseSemaphore: function _releaseSemaphore(semHolder)
	{
	},

  //  boolean testSemaphore (in nsISupports semHolder);
	testSemaphore: function _testSemaphore(semHolder)
	{
	},

  //  readonly attribute boolean locked;
	get locked()
	{
		return true;
	},

  //  void getNewMessages(in nsIMsgWindow aWindow, in nsIUrlListener aListener);
	getNewMessages: function _getNewMessages(aWindow, aListener)
	{
	},

  /**
   * write out summary data for this folder
   * to the given folder cache (i.e. panacea.dat)
   */
  //  void writeToFolderCache(in nsIMsgFolderCache folderCache, in boolean deep);
	writeToFolderCache: function _writeToFolderCache(folderCache, deep)
	{
	},

  /**
   * the charset of this folder
   */
  //  attribute ACString charset;
	get charset() {
    return true;
	},

	set charset(aValue) {
	},

  //  attribute boolean charsetOverride;
	get charsetOverride() {
		return true;
	},

	set charsetOverride(aValue) {
	},

  //  attribute unsigned long biffState;
	get biffState() {
		return true;
	},

	set biffState(aValue) {
	},

  /**
   * the number of new messages since this folder was last visited
   * @param deep if true, descends into all subfolders and gets a grand total
   */

  //   long getNumNewMessages (in boolean deep);
	getNumNewMessages: function _getNumNewMessages(deep) {
	},

  //   void setNumNewMessages(in long numNewMessages);
	setNumNewMessages: function _setNumNewMessages(numNewMessages) {
	},

  /**
   * attribute boolean gettingNewMessages;
   * are we running a url as a result of the user clicking get msg?
   */
	get gettingNewMessages() {
		return true;
	},

	set gettingNewMessages(aValue) {
	},

  /**
   * attribute nsIFile filePath;
   * local path of this folder
   */
	get filePath() {
    //must be the copy version, otherwise, this.path may changed by other
		return this._path.clone();
	},

	set filePath(aValue) {
		this._path = aValue;
	},

  //  readonly attribute ACString baseMessageURI;
	get baseMessageURI() {
		return this._baseMessageUri;
	},

  //  ACString generateMessageURI(in nsMsgKey msgKey);
	generateMessageURI: function _generateMessageURI(msgKey) {
    return this.baseMessageURI + '#' + msgKey;
	},

  //  const nsMsgDispositionState nsMsgDispositionState_None = -1;
  //  const nsMsgDispositionState nsMsgDispositionState_Replied = 0;
  //  const nsMsgDispositionState nsMsgDispositionState_Forwarded = 1;
  //  void addMessageDispositionState(in nsIMsgDBHdr aMessage,
  //                                  in nsMsgDispositionState aDispositionFlag);
	addMessageDispositionState: function _addMessageDispositionState(aMessage, aDispositionFlag)
	{
	},

    //  void markMessagesRead(in nsIArray messages, in boolean markRead);
	markMessagesRead: function _markMessagesRead(messages, markRead)
	{
	},

  //  void markAllMessagesRead(in nsIMsgWindow aMsgWindow);
	markAllMessagesRead: function _markAllMessagesRead(aMsgWindow)
	{
	},

  //  void markMessagesFlagged(in nsIArray messages, in boolean markFlagged);
	markMessagesFlagged: function _markMessagesFlagged(messages, markFlagged)
	{
	},

  //  void markThreadRead(in nsIMsgThread thread);
	markThreadRead: function _markThreadRead(thread)
	{
	},

  //  void setLabelForMessages(in nsIArray messages, in nsMsgLabelValue label);
	setLabelForMessages: function _setLabelForMessages(messages, label)
	{
	},

  /**
   * attribute nsIMsgDatabase msgDatabase;
   * Gets the message database for the folder.
   *
   * Note that if the database is out of date, the implementation MAY choose to
   * throw an error. For a handle to the database which MAY NOT throw an error,
   * one can use getDBFolderInfoAndDB.
   *
   * @exception NS_MSG_ERROR_FOLDER_SUMMARY_MISSING If the database does not
   *                         exist.
   * @exception NS_MSG_ERROR_FOLDER_SUMMARY_OUT_OF_DATE If the database contains
   *                         out of date information.
   * @see nsIMsgFolder::getDBFolderInfoAndDB.
   */
	get msgDatabase() {
    if(!this._database) this.openDatabase();
		return this._database;
	},

	set msgDatabase(aValue) {
  },

  openDatabase: function() {
    var dbService = Cc['@mozilla.org/msgDatabase/msgDBService;1']
      .getService(Ci.nsIMsgDBService);
    try {
      this._database = dbService.openFolderDB(this, true);
    } catch(e) {
      if(e.result === Cr.NS_MSG_ERROR_FOLDER_SUMMARY_MISSING) {
        var db = dbService.createNewDB(this);
        if(!db) return;
        updateSummaryTotals(true);
        db.close(true);
        this._database = dbService.openFolderDB(this, false);
      } else {
        folderLog.error('cannot open database');
        throw e;
      }
    }
  },
  /**
   * Get the backup message database, used in reparsing. This database must
   * be created first using closeAndBackupFolderDB()
   *
   * @return   backup message database
   */
  //  nsIMsgDatabase getBackupMsgDatabase();
	getBackupMsgDatabase: function _getBackupMsgDatabase()
	{
	},

  /**
   * Remove the backup message database file
   */
  //  void removeBackupMsgDatabase();
	removeBackupMsgDatabase: function _removeBackupMsgDatabase()
	{
	},

  /**
   * Open the backup message database file
   */
  //  void openBackupMsgDatabase();
	openBackupMsgDatabase: function _openBackupMsgDatabase()
	{
	},

    //  nsIMsgDatabase getDBFolderInfoAndDB(out nsIDBFolderInfo folderInfo);
	getDBFolderInfoAndDB: function(folderInfo) {
    if(this._isServer) return null;
    if(!this._database)
      this.openDatabase();
    folderLog.info('get the dbfolder info and db');
    var db = this._database;
    if(db && folderInfo)  folderInfo.value = db.dBFolderInfo;
    return db;
	},

  //  nsIMsgDBHdr GetMessageHeader(in nsMsgKey msgKey);
	GetMessageHeader: function _GetMessageHeader(msgKey)
	{
	},

  //  readonly attribute boolean supportsOffline;
	get supportsOffline()
	{
		return true;
	},

  //  boolean shouldStoreMsgOffline(in nsMsgKey msgKey);
	shouldStoreMsgOffline: function _shouldStoreMsgOffline(msgKey)
	{
	},

  //  boolean hasMsgOffline(in nsMsgKey msgKey);
	hasMsgOffline: function _hasMsgOffline(msgKey)
	{
	},

  /**
   * Get an input stream to read the offline contents of an imap or news
   * message.
   *
   * @param aMsgKey key of message to get input stream for.
   * @param[out] aOffset filled in with the offset into the stream of the message.
   * @param[out] aSize filled in with the size of the message in the offline store.
   *
   * @returns input stream to read the message from.
   */
  //  nsIInputStream getOfflineFileStream(in nsMsgKey aMsgKey,
  //                                      out long long aOffset,
  //                                      out unsigned long aSize);
	getOfflineFileStream: function _getOfflineFileStream(aMsgKey, aOffset, aSize)
	{
	},

  /**
   * Get the folder where the msg could be present.
   * @param msgKey  key of the msg for which we are trying to get the folder;
   * @returns aMsgFolder  required folder;
   *
   */
  //  nsIMsgFolder GetOfflineMsgFolder(in nsMsgKey msgKey);
	GetOfflineMsgFolder: function _GetOfflineMsgFolder(msgKey)
	{
	},

  /**
   * Get an offline store output stream for the passed message header.
   *
   * @param aHdr hdr of message to get outputstream for
   * @returns An output stream to write to.
   */
  //  nsIOutputStream getOfflineStoreOutputStream(in nsIMsgDBHdr aHdr);
	getOfflineStoreOutputStream: function _getOfflineStoreOutputStream(aHdr)
	{
	},

  /**
   * nsIInputStream getMsgInputStream(in nsIMsgDBHdr aHdr,
      out boolean aReusable);
   * Get an input stream for the passed message header. The stream will
   * be positioned at the start of the message.
   *
   * @param aHdr hdr of message to get the input stream for.
   * @param[out] aReusable set to true if the stream can be re-used, in which
                           case the caller might not want to close it.
   * @returns an input stream to read the message from
   */
	getMsgInputStream: function(aHdr, aReusable) {
    var offset = {};
    var input = this.msgStore.getMsgInputStream(this, '', offset, aHdr,
      aReusable);
    var seekableStream = input.QueryInterface(Ci.nsISeekableStream);
    offset = offset.value;
    seekableStream && seekableStream.seek(seekableStream.NS_SEEK_SET, offset);
    return input;
	},

  //  readonly attribute nsIInputStream offlineStoreInputStream;
	get offlineStoreInputStream()
	{
		return true;
	},

  //  void DownloadMessagesForOffline(in nsIArray messages,
  //                                  in nsIMsgWindow window);
	DownloadMessagesForOffline: function _DownloadMessagesForOffline(messages, window)
	{
	},

  //  nsIMsgFolder getChildWithURI(in ACString uri, in boolean deep,
  //                               in boolean caseInsensitive);
	getChildWithURI: function _getChildWithURI(uri, deep, caseInsensitive)
	{
	},

  //  void downloadAllForOffline(in nsIUrlListener listener, in nsIMsgWindow window);
	downloadAllForOffline: function _downloadAllForOffline(listener, window)
	{
	},

  /**
   *  Turn notifications on/off for various notification types. Currently only
   *  supporting allMessageCountNotifications which refers to both total and
   *  unread message counts.
   */
  //  const unsigned long allMessageCountNotifications    = 0;
  //  void enableNotifications(in long notificationType, in boolean enable,
  //                           in boolean dbBatching);
	enableNotifications: function _enableNotifications(notificationType, enable, dbBatching)
	{
	},

  //  boolean isCommandEnabled(in ACString command);
	isCommandEnabled: function _isCommandEnabled(command)
	{
	},

  //  boolean matchOrChangeFilterDestination(in nsIMsgFolder folder,
  //                                         in boolean caseInsensitive);
	matchOrChangeFilterDestination: function _matchOrChangeFilterDestination(folder, caseInsensitive)
	{
	},

  //  boolean confirmFolderDeletionForFilter(in nsIMsgWindow msgWindow);
	confirmFolderDeletionForFilter: function _confirmFolderDeletionForFilter(msgWindow)
	{
	},

  //  void alertFilterChanged(in nsIMsgWindow msgWindow);
	alertFilterChanged: function _alertFilterChanged(msgWindow)
	{
	},

  //  void throwAlertMsg(in string msgName, in nsIMsgWindow msgWindow);
	throwAlertMsg: function _throwAlertMsg(msgWindow)
	{
	},

  //  AString getStringWithFolderNameFromBundle(in string msgName);
	getStringWithFolderNameFromBundle: function _getStringWithFolderNameFromBundle(msgName)
	{
	},

  //  void notifyCompactCompleted();
	notifyCompactCompleted: function _notifyCompactCompleted()
	{
	},

  //  long compareSortKeys(in nsIMsgFolder msgFolder);
	compareSortKeys: function _compareSortKeys(msgFolder)
	{
	},

  /**
   * Returns a sort key that can be used to sort a list of folders.
   *
   * Prefer nsIMsgFolder::compareSortKeys over this function.
   */
  //  void getSortKey(out unsigned long length, [array, size_is(length), retval] out octet key);
	getSortKey: function _getSortKey(length)
	{
	},

  //  attribute nsIMsgRetentionSettings retentionSettings;
	get retentionSettings()
	{
		return true;
	},

	set retentionSettings(aValue)
	{
	},

  //  attribute nsIMsgDownloadSettings downloadSettings;
	get downloadSettings()
	{
		return true;
	},

	set downloadSettings(aValue)
	{
	},

  //  boolean callFilterPlugins(in nsIMsgWindow aMsgWindow);
  /**
   * used for order in the folder pane, folder pickers, etc.
   */
  //  attribute long sortOrder;
	get sortOrder()
	{
		return true;
	},

	set sortOrder(aValue)
	{
	},

  //  attribute nsIDBFolderInfo dBTransferInfo;
	get dBTransferInfo()
	{
		return true;
	},

	set dBTransferInfo(aValue)
	{
	},

  //  ACString getStringProperty(in string propertyName);
	getStringProperty: function _getStringProperty(propertyName)
	{
	},

  //  void setStringProperty(in string propertyName, in ACString propertyValue);
	setStringProperty: function _setStringProperty(msgWipropertyName, propertyValuendow)
	{
	},

  /* does not persist across sessions */
  //  attribute nsMsgKey lastMessageLoaded;
	get lastMessageLoaded()
	{
		return true;
	},

	set lastMessageLoaded(aValue)
	{
	},

  /* old nsIFolder properties and methods */
  //  readonly attribute ACString URI;
	get URI() {
		return 'exchange://' + this.username + '@' + this.hostname + this.name;
	},

  //  attribute AString name;
	get name() {
		return this._name;
	},

	set name(name) {
		this._name = name;
	},

  //  attribute AString prettyName;
	get prettyName() {
		return this.name;
	},

	set prettyName(name) {
		this.name = name;
	},

  /*  readonly attribute AString abbreviatedName;
      abbreviated name is used to show in the folder view
  */
	get abbreviatedName() {
    if(this._isServer)
      return this._username + '@' + this._hostname;
		return this._name;
	},

  //  attribute nsIMsgFolder parent;
	get parent()
	{
		return this._parent;
	},

	set parent(parent) {
		this._parent = parent;
		if(parent) {
			this._isServer = false;
			this._isServerIsValid = false;
			this._server = parent.server;
		}
	},

  /*
   * void createSubfolder(in AString folderName, in nsIMsgWindow msgWindow);
   */
  createSubFolder: function(folderName, msgWindow) {
    var msgStore = this.server.msgStore;
    return msgStore.createFolder(this, folderName);
  },

  getSubFolder: function(folderName) {
    return this.getChildNamed(folderName) || this.createSubFolder(folderName);
  },

  get descendants() {
    return this._subfolders;
  },

  setFlagForFolder: function(folder) {
    var folderFlags = Ci.nsMsgFolderFlags.Mail;
    if(this._server) {
      switch(folder.name) {
        case 'Inbox': { folderFlags |= Ci.nsMsgFolderFlags.Inbox; break; }
        case 'Trash': { folderFlags |= Ci.nsMsgFolderFlags.Trash; break; }
      }
    }
    folder.flags = folderFlags;
  },
  /**
   * readonly attribute nsISimpleEnumerator subFolders;
   * Returns an enumerator containing a list of nsIMsgFolder items that are
   * subfolders of the instance this is called on.
   */
	get subFolders() {
		if(!this._initialize) {
		  this._isServer && this.server.msgStore.discoverSubFolders(this, true);

      var filePath = this.filePath;
      var FolderFlags = Ci.nsMsgFolderFlags;

      if(filePath.isDirectory()) {
        this.flags = FolderFlags.Mail |
          FolderFlags.Directory | FolderFlags.Elided;
      }

      if(this._isServer) {
        this.getSubFolder('Inbox');
        this.getSubFolder('Trash');
      }

      var self = this;
      this._subfolders.forEach(function(folder) {
        self.setFlagForFolder(folder);
      });
			this._initialize = true;
		}
		return createSimpleEnumerator(this._subfolders);
	},

  /**
   * Returns true if this folder has sub folders.
   */
  //  readonly attribute boolean hasSubFolders;
	get hasSubFolders()
	{
		return true;
	},

  /**
   * Returns the number of sub folders that this folder has.
   */
  //  readonly attribute unsigned long numSubFolders;
	get numSubFolders()
	{
		return true;
	},

  /**
   * Determines if this folder is an ancestor of the supplied folder.
   *
   * @param folder  The folder that may or may not be a descendent of this
   *                folder.
   */
  //  boolean isAncestorOf(in nsIMsgFolder folder);
	isAncestorOf: function _isAncestorOf(folder)
	{
	},

  /**
   * Looks in immediate children of this folder for the given name.
   *
   * @param name the name of the target subfolder
   */
  //  boolean containsChildNamed(in AString name);
	containsChildNamed: function _containsChildNamed(name)
	{
	},

  /**
   * Return the child folder which the specified name.
   *
   * @param aName  The name of the child folder to find
   * @return       The child folder
   * @exception NS_ERROR_FAILURE Thrown if the folder with aName does not exist
   */
  //  nsIMsgFolder getChildNamed(in AString aName);
	getChildNamed: function _getChildNamed(aName) {
    var subfolders = this._subfolders;
    var length = subfolders.length;
    for(var i = 0; i < length; ++i) {
      if(subfolders[i].name === aName)  return subfolders[i];
    }
	},

  /**
   * Finds the sub folder with the specified name.
   *
   * @param escapedSubFolderName  The name of the sub folder to find.
   * @note                        Even if the folder doesn't currently exist,
   *                              a nsIMsgFolder may be returned.
   */
  //  nsIMsgFolder findSubFolder(in ACString escapedSubFolderName);
	findSubFolder: function _findSubFolder(escapedSubFolderName)
	{

	},

  //  void AddFolderListener(in nsIFolderListener listener);
	AddFolderListener: function _AddFolderListener(listener)
	{
	},

  //  void RemoveFolderListener(in nsIFolderListener listener);
	RemoveFolderListener: function _RemoveFolderListener(listener)
	{
	},

  //  void NotifyPropertyChanged(in nsIAtom property,
  //                             in ACString oldValue,
  //                             in ACString newValue);
	NotifyPropertyChanged: function _NotifyPropertyChanged(property, oldValue, newValue)
	{
	},

  //  void NotifyIntPropertyChanged(in nsIAtom property,
  //                                in long oldValue,
  //                                in long newValue);
	NotifyIntPropertyChanged: function(property, oldValue, newValue) {
    folderLog.info('notify int property changed');
    var self = this;
    this._listeners.forEach(function(listener) {
      listener.OnItemIntPropertyChanged(self, property, oldValue, newValue);
    });

    listenerManager.OnItemIntPropertyChanged(self, property,
      oldValue, newValue);
	},

  //  void NotifyBoolPropertyChanged(in nsIAtom property,
  //                                 in boolean oldValue,
  //                                 in boolean newValue);
	NotifyBoolPropertyChanged: function(property, oldValue, newValue) {
    var self = this;
    this._listeners.forEach(function(listener) {
      listener.OnItemBoolPropertyChanged(self, property, oldValue, newValue);
    });

    listenerManager.OnItemBoolPropertyChanged(self, property,
      oldValue, newValue);
	},

  //  void NotifyPropertyFlagChanged(in nsIMsgDBHdr item,
  //                                 in nsIAtom property,
  //                                 in unsigned long oldValue,
  //                                 in unsigned long newValue);
	NotifyPropertyFlagChanged: function(item, property, oldValue, newValue) {
	},

  //  void NotifyUnicharPropertyChanged(in nsIAtom property,
  //                                    in AString oldValue,
  //                                    in AString newValue);
	NotifyUnicharPropertyChanged: function _NotifyUnicharPropertyChanged(property, oldValue, newValue)
	{
	},

  //  void NotifyItemAdded(in nsISupports item);
	NotifyItemAdded: function _NotifyItemAdded(item)
	{
	},

  //  void NotifyItemRemoved(in nsISupports item);
	NotifyItemRemoved: function _NotifyItemRemoved(item)
	{
	},

  //  void NotifyFolderEvent(in nsIAtom event);
	NotifyFolderEvent: function _NotifyFolderEvent(event)
	{
	},

  //  void NotifyFolderLoaded();
	NotifyFolderLoaded: function _NotifyFolderLoaded()
	{
	},

  //  void NotifyDeleteOrMoveMessagesCompleted(in nsIMsgFolder folder);
	NotifyDeleteOrMoveMessagesCompleted: function _NotifyDeleteOrMoveMessagesCompleted(folder)
	{
	},

  // lists all descendents, not just first level children
  //  void ListDescendents(in nsISupportsArray descendents);
	ListDescendents: function _ListDescendents(descendents)
	{
	},

  //  void Shutdown(in boolean shutdownChildren);
	Shutdown: function _Shutdown(shutdownChildren)
	{
	},

  //  readonly attribute boolean inVFEditSearchScope;
	get inVFEditSearchScope()
	{
		return true;
	},

  //  void setInVFEditSearchScope(in boolean aSearchThisFolder, in boolean aSetOnSubFolders);
	setInVFEditSearchScope: function _setInVFEditSearchScope(aSearchThisFolder, aSetOnSubFolders)
	{
	},

  //  void copyDataToOutputStreamForAppend(in nsIInputStream aIStream,
  //                     in long aLength, in nsIOutputStream outputStream);
	copyDataToOutputStreamForAppend: function _copyDataToOutputStreamForAppend(aIStream, aLength, outputStream)
	{
	},

  //  void copyDataDone();
	copyDataDone: function _copyDataDone()
	{
	},

  //  void setJunkScoreForMessages(in nsIArray aMessages, in ACString aJunkScore);
	setJunkScoreForMessages: function _setJunkScoreForMessages(aMessages, aJunkScore)
	{
	},

  //  void applyRetentionSettings();
	applyRetentionSettings: function _applyRetentionSettings()
	{
	},

  /**
   * Get the beginning of the message bodies for the passed in keys and store
   * them in the msg hdr property "preview". This is intended for
   * new mail alerts, title tips on folders with new messages, and perhaps
   * titletips/message preview in the thread pane.
   *
   * @param aKeysToFetch   keys of msgs to fetch
   * @param aNumKeys       number of keys to fetch
   * @param aLocalOnly     whether to fetch msgs from server (imap msgs might
   *                       be in memory cache from junk filter)
   * @param aUrlListener   url listener to notify if we run url to fetch msgs
   *
   * @result aAsyncResults if true, we ran a url to fetch one or more of msg bodies
   *
   */
  //  boolean fetchMsgPreviewText([array, size_is (aNumKeys)] in nsMsgKey aKeysToFetch,
  //                      in unsigned long aNumKeys, in boolean aLocalOnly,
  //                      in nsIUrlListener aUrlListener);
	fetchMsgPreviewText: function _fetchMsgPreviewText(aKeysToFetch, aNumKeys, aLocalOnly, aUrlListener)
	{
	},

  // used to set/clear tags - we could have a single method to setKeywords which
  // would figure out the diffs, but these methods might be more convenient.
  // keywords are space delimited, in the case of multiple keywords
  //  void addKeywordsToMessages(in nsIArray aMessages, in ACString aKeywords);
	addKeywordsToMessages: function _addKeywordsToMessages(aMessages, aKeywords)
	{
	},

  //  void removeKeywordsFromMessages(in nsIArray aMessages, in ACString aKeywords);
	removeKeywordsFromMessages: function _removeKeywordsFromMessages(aMessages, aKeywords)
	{
	},

  /**
   * Extract the message text from aStream.
   *
   * @param aStream stream to read from
   * @param aCharset character set to use to interpret the body. If an empty string, then the
   *        charset is retrieved from the headers. msgHdr.charset is recommended in case you have it.
   * @param aBytesToRead number of bytes to read from the stream. The function will read till the end
   *        of the line, and there will also be some read ahead due to NS_ReadLine
   * @param aMaxOutputLen desired length of the converted message text. Used to control how many characters
   *        of msg text we want to store.
   * @param aCompressQuotes Replace quotes and citations with " ... " in the preview text
   * @param aStripHTMLTags strip HTML tags from the output, if present
   * @param[out] aContentType the content type of the MIME part that was used to generate the text --
   *             for an HTML part, this will be "text/html" even though aStripHTMLTags might be true
   */
  //  AUTF8String getMsgTextFromStream(in nsIInputStream aStream, in ACString aCharset,
  //                                   in unsigned long aBytesToRead, in unsigned long aMaxOutputLen,
  //                                   in boolean aCompressQuotes, in boolean aStripHTMLTags,
  //                                   out ACString aContentType);
	getMsgTextFromStream: function _getMsgTextFromStream(aStream, aCharset, aBytesToRead, aMaxOutputLen,
								aCompressQuotes, aStripHTMLTags, aContentType)
	{
	},

  //  AString convertMsgSnippetToPlainText(in AString aMessageText);
	convertMsgSnippetToPlainText: function _convertMsgSnippetToPlainText(aMessageText)
	{
	},

  // this allows a folder to have a special identity. E.g., you might want to
  // associate an identity with a particular newsgroup, or for IMAP shared folders in
  // the other users namespace, you might want to create a delegated identity
  //  readonly attribute nsIMsgIdentity customIdentity;
	get customIdentity() {
		return null;
	},

  /**
   * @{
   * Processing flags, used to manage message processing.
   *
   * @param msgKey   message key
   * @return         processing flags
   */
  //  unsigned long getProcessingFlags(in nsMsgKey msgKey);
	getProcessingFlags: function _getProcessingFlags(msgKey)
	{
	},

  /**
   * @param msgKey   message key
   * @param mask     mask to OR into the flags
   */
  //  void orProcessingFlags(in nsMsgKey msgKey, in unsigned long mask);
	orProcessingFlags: function _orProcessingFlags(msgKey, mask)
	{
	},

  /**
   * @param msgKey   message key
   * @param mask     mask to AND into the flags
   */
  //  void andProcessingFlags(in nsMsgKey msgKey, in unsigned long mask);
	andProcessingFlags: function _andProcessingFlags(msgKey, mask)
	{
	},

  /** @} */

  /**
   * Gets an inherited string property from the folder.
   *
   * If the forcePropertyEmpty boolean is set (see below), return an
   * empty string.
   *
   * If the specified folder has a non-empty value for the property,
   * return that value. Otherwise, return getInheritedStringProperty
   * for the folder's parent.
   *
   * If a folder is the root folder for a server, then instead of
   * checking the folder property, check the property of the same name
   * for the server using nsIMsgIncomingServer.getCharValue(...)
   *
   * Note nsIMsgIncomingServer.getCharValue for a server inherits from
   * the preference mail.server.default.(propertyName) as a global value
   *
   * (ex: if propertyName = "IAmAGlobal" and no folder nor server properties
   * are set, then the inherited property will return the preference value
   * mail.server.default.IAmAGlobal)
   *
   * If the propertyName is undefined, returns an empty, void string.
   *
   * @param propertyName  The name of the property for the value to retrieve.
   */
  //  ACString getInheritedStringProperty(in string propertyName);
	getInheritedStringProperty: function _getInheritedStringProperty(propertyName)
	{
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
	},

  /**
   * Pluggable store for this folder. Currently, this will always be the same
   * as the pluggable store for the server.
   */
  //  readonly attribute nsIMsgPluggableStore msgStore;
	get msgStore() {
		return this.server.msgStore;
	},
};


var components = [mivExchangeMsgFolder];
if ("generateNSGetFactory" in XPCOMUtils)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);  // Firefox 4.0 and higher
else
  var NSGetModule = XPCOMUtils.generateNSGetModule(components);    // Firefox 3.x
