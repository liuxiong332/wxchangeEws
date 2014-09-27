QUnit.module('nsIMstIncomingServer test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;

    QUnit.Cu.import('resource:///modules/mailServices.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.log = QUnit.commonFunctions.Log
      .getInfoLevelLogger('test-incomingserver');
  },
  teardown: function() {
    delete QUnit.MailServices;
    delete QUnit.commonFunctions;
  }
});

QUnit.NewExchangeAccount = function() {
  this.account = null;
  this.server = null;
  this.create();
}
QUnit.NewExchangeAccount.prototype.create = function() {
  var config = {
    username: 'liuxiong',
    hostname: 'kingsoft.com',
    email: 'liuxiong@kingsoft.com',
    type: 'exchange',
    password: 'abcd.ABCD'
  };
  this.config = config;

  var server = QUnit.MailServices.accounts.createIncomingServer(config.username,
    config.hostname, config.type);
  server.password = config.password;
  server.valid = true;

  var identity = QUnit.MailServices.accounts.createIdentity();
  identity.fullName = config.username;
  identity.email = config.email;
  identity.valid = true;

  var account = QUnit.MailServices.accounts.createAccount();
  account.addIdentity(identity);
  account.incomingServer = server;

  this.account = account;
  this.server = server;
};

QUnit.NewExchangeAccount.prototype.destroy = function() {
  QUnit.MailServices.accounts.removeAccount(this.account);
};

QUnit.test('set incoming server test', function(assert) {
  var newAccount = new QUnit.NewExchangeAccount;

  var server = newAccount.server;
  var config = newAccount.config;

  assert.deepEqual(QUnit.MailServices.accounts.FindServer(config.username,
    config.hostname, config.type), server,
    'create and insert server successfully');

  assert.ok(server, 'get the server');
  assert.ok(server.localPath, 'server local path is ' + server.localPath.path);

  function assertRootFolder() {
    assert.ok(server.rootFolder, 'can get the root folder');
    assert.ok(server.rootFolder.filePath, 'get the root folder file path');
  }
  // assertRootFolder();

  function assertSubFolders() {
    var inboxFolder = server.rootFolder.getFolderWithFlags(
      QUnit.Ci.nsMsgFolderFlags.Inbox);
    assert.ok(inboxFolder, 'can get the inbox folder');

    var inboxFolders = server.rootFolder.getFoldersWithFlags(
      QUnit.Ci.nsMsgFolderFlags.Inbox);
    assert.ok(inboxFolders, 'can get inbox folder array');
    assert.equal(inboxFolders.length, 1, 'only 1 inbox folder');
  }
  assertSubFolders();

  function assertDatabase() {
    assert.ok(server.rootFolder.server, 'get server from the root folder');
    assert.ok(server.rootFolder.msgStore, 'get msgStore from the root folder');
    var subfolders = server.rootFolder.subFolders;
    var msgStore = server.msgStore;
    while(subfolders.hasMoreElements()) {
      var folder = subfolders.getNext().QueryInterface(QUnit.Ci.nsIMsgFolder);
      QUnit.log.info('summary file is ' + msgStore.getSummaryFile(folder).path);
      assert.ok(folder.getDBFolderInfoAndDB({}), 'get the folder database');
    }
  }
  assertDatabase();
  newAccount.destroy();
});

QUnit.test('incoming server notify test', function(assert) {
  expect(1);
  var newAccount = new QUnit.NewExchangeAccount;
  var server = newAccount.server;
  var newFlag = QUnit.Ci.nsMsgFolderFlags.Virtual;

  var folderListener = {
    OnItemIntPropertyChanged: function(item, property, oldValue, newValue) {
      assert.ok(newValue & newFlag, 'the new flag is set');
    }
  };
  QUnit.MailServices.mailSession.AddFolderListener(folderListener,
    QUnit.Ci.nsIFolderListener.intPropertyChanged);
  server.rootFolder.flags = newFlag;
  QUnit.MailServices.mailSession.RemoveFolderListener(folderListener);
  newAccount.destroy();
});

// QUnit.test('get new msg for inbox', function(assert) {
//   var newAccount = new QUnit.NewExchangeAccount;
//   var server = newAccount.server;

//   var inbox = server.rootFolder.getFolderWithFlags(
//     QUnit.Ci.nsMsgFolderFlags.Inbox);

//   //clear the old new messages
//   inbox.biffState = nsMsgBiffState_NoMail;
//   inbox.clearNewMessages();
//   server.getNewMessages(inbox, null, null);
//   newAccount.destroy();
// });

// QUnit.test('open inbox folder', function(assert) {
//   var newAccount = new QUnit.NewExchangeAccount;
//   var server = newAccount.server;

//   var inbox = server.rootFolder.getFolderWithFlags(
//     QUnit.Ci.nsMsgFolderFlags.Inbox);

//   assert.ok(inbox.msgDatabase, 'get msgDatabase');
//   assert.ok(inbox.server, 'get server from inbox');
//   assert.ok(server.type, 'get server type');

//   var db = inbox.getDBFolderInfoAndDB({});
//   assert.ok(db, 'get the db');

// });

QUnit.test('insert new message', function(assert) {
  var newAccount = new QUnit.NewExchangeAccount;
  var server = newAccount.server;

  var inbox = server.rootFolder.getFolderWithFlags(
    QUnit.Ci.nsMsgFolderFlags.Inbox);
  assert.ok(inbox, 'get inbox');

  var msgStore = server.msgStore;
  var newHdr = {};
  var outStream = msgStore.getNewMsgOutputStream(inbox, newHdr, {});
  newHdr = newHdr.value;
  assert.ok(newHdr && outStream, 'get new hdr and output stream');

  newAccount.destroy();
});
