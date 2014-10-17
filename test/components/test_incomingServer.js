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
    // delete QUnit.MailServices;
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

/*QUnit.test('get new msg for inbox', function(assert) {
  var newAccount = new QUnit.NewExchangeAccount;
  var server = newAccount.server;

  var inbox = server.rootFolder.getFolderWithFlags(
    QUnit.Ci.nsMsgFolderFlags.Inbox);

  //clear the old new messages
  inbox.biffState = nsMsgBiffState_NoMail;
  inbox.clearNewMessages();
  server.getNewMessages(inbox, null, null);
  newAccount.destroy();
});

QUnit.test('open inbox folder', function(assert) {
  var newAccount = new QUnit.NewExchangeAccount;
  var server = newAccount.server;

  var inbox = server.rootFolder.getFolderWithFlags(
    QUnit.Ci.nsMsgFolderFlags.Inbox);

  assert.ok(inbox.msgDatabase, 'get msgDatabase');
  assert.ok(inbox.server, 'get server from inbox');
  assert.ok(server.type, 'get server type');

  var db = inbox.getDBFolderInfoAndDB({});
  assert.ok(db, 'get the db');
});*/
QUnit.testSkip = function() {};
QUnit.testSkip('insert new message', function(assert) {
  var newAccount = new QUnit.NewExchangeAccount;
  var server = newAccount.server;

  var msgId = '@MsgNo.1';
  var inbox = server.rootFolder.getFolderWithFlags(
    QUnit.Ci.nsMsgFolderFlags.Inbox);
  assert.ok(inbox, 'get inbox');

  var msgStore = server.msgStore;
  var newHdr = {};
  var outStream = msgStore.getNewMsgOutputStream(inbox, newHdr, {});
  newHdr = newHdr.value;
  assert.ok(newHdr && outStream, 'get new hdr and output stream');

  newHdr.author = 'liuxiong332';
  newHdr.subject = 'test new Message';
  newHdr.recipients = 'All test Users';
  newHdr.messageId = msgId;
  newHdr.accountKey = newAccount.account.key;
  newHdr.OrFlags(QUnit.Ci.nsMsgMessageFlags.New);


  var message = 'From: "liuxiong332"\r\n'
    + 'To: "All test Users"\r\n'
    + 'Subject: "test new Message"\r\n'
    + 'Content-Type: text/html\r\n' + '\r\n'
    + '<html><body>Hello World</body></html>\r\n';

  function convertToUTF8(str) {
    var converter = QUnit.Cc['@mozilla.org/intl/scriptableunicodeconverter']
      .getService(QUnit.Ci.nsIScriptableUnicodeConverter);
    return converter.convertToByteArray(str, {});
  }

  var binaryStream = QUnit.Cc['@mozilla.org/binaryoutputstream;1']
    .createInstance(QUnit.Ci.nsIBinaryOutputStream);
  binaryStream.setOutputStream(outStream);

  var readLineReg = /(.*?)\r\n/g;
  var matchRes;
  var isBody = false;
  var byteSize = 0;
  var byteArray, bodyLines = 0;
  while((matchRes = readLineReg.exec(message))) {
    if(isBody)  ++ bodyLines;
    byteArray = convertToUTF8(matchRes[0]);
    byteSize += byteArray.length;
    binaryStream.writeByteArray(byteArray, byteArray.length);
    if(matchRes[1] === '')  isBody = true;
  }
  newHdr.lineCount = bodyLines;
  newHdr.messageSize = byteSize;
  binaryStream.close();
  outStream.close();

  assert.equal(bodyLines, 1);
  assert.equal(byteSize, message.length);

  if(inbox.msgDatabase.ContainsKey(newHdr.messageKey))
    inbox.msgDatabase.DeleteHeader(newHdr, null, true, false);
  inbox.msgDatabase.AddNewHdrToDB(newHdr, true);
  inbox.msgDatabase.Commit(QUnit.Ci.nsMsgDBCommitType.kLargeCommit);

  assert.ok(inbox.msgDatabase.GetMsgHdrForKey(newHdr.messageKey));

  var msgUri = inbox.generateMessageURI(newHdr.messageKey);
  assert.ok(msgUri && /^exchange-message/.test(msgUri));
  newAccount.destroy();
});


// QUnit.test('protocol DisplayMessage', function(assert) {
//   var url = {};
//   var newAccount = new QUnit.NewExchangeAccount;
//   var config = newAccount.config;

//   var msgUri = 'exchange-message://' + config.username + '@' + config.hostname
//     + '/Inbox#110';

//   var msgServiceID =
//     '@mozilla.org/messenger/messageservice;1?type=exchange-message';
//   var msgService = QUnit.Cc[msgServiceID]
//     .getService(QUnit.Ci.nsIMsgMessageService);
//   msgService.DisplayMessage(msgUri, null, null, null, null, url);
//   url = url.value;
//   assert.ok(url);
//   newAccount.destroy();
// });

// QUnit.asyncTest('http test', function(assert) {
//   function HttpUtil(hostname, timeout) {

//     var xmlReq = QUnit.Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
//     xmlReq.timeout = timeout * 1000;

//     xmlReq.addEventListener("error", function(event) {
//       QUnit.log.info('error, the status code:' + xmlReq.statusText);
//       QUnit.start();
//     });
//     xmlReq.addEventListener("abort", function(event) {
//       QUnit.log.info('abort');
//       QUnit.start();
//     });
//     xmlReq.addEventListener("load", function(event) {
//       QUnit.log.info('load the status text:' + xmlReq.statusText + ', the response:'
//         + xmlReq.responseText);
//       QUnit.start();
//     });
//     xmlReq.ontimeout = function() {
//       QUnit.log.info('timeout');
//       QUnit.start();
//     };

//     var ewsUrl = "https://" + hostname + "/EWS/exchange.asmx";
//     xmlReq.open("POST", ewsUrl, true);
//     xmlReq.send();
//     QUnit.log.info('post to ' + ewsUrl);
//   }

//   HttpUtil('snt405-m.hotmail.com', 10);
// })
