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

QUnit.test('set incoming server test', function(assert) {
  var config = {
    username: 'liuxiong',
    hostname: 'kingsoft.com',
    email: 'liuxiong@kingsoft.com',
    type: 'exchange',
    password: 'abcd.ABCD'
  };

  var server = QUnit.MailServices.accounts.createIncomingServer(config.username,
    config.hostname, config.type);
  assert.deepEqual(QUnit.MailServices.accounts.FindServer(config.username,
    config.hostname, config.type), server,
    'create and insert server successfully');

  assert.ok(server, 'get the server');
  server.password = config.password;
  server.valid = true;
  assert.ok(server.localPath, 'server local path is ' + server.localPath.path);

  var identity = QUnit.MailServices.accounts.createIdentity();
  identity.fullName = config.username;
  identity.email = config.email;
  identity.valid = true;

  var account = QUnit.MailServices.accounts.createAccount();
  account.addIdentity(identity);
  assert.ok(server.rootFolder, 'can get the root folder');
  assert.ok(server.rootFolder.filePath, 'get the root folder file path');

  account.incomingServer = server;

  var subfolders = server.rootFolder.subFolders;
  while(subfolders.hasMoreElements()) {
    var folder = subfolders.getNext().QueryInterface(QUnit.Ci.nsIMsgFolder);
    QUnit.log.info('the folder ' + folder.filePath.path
       + ' flags: ' + folder.flags);
  }
  var inboxFolder = server.rootFolder.getFolderWithFlags(
    QUnit.Ci.nsMsgFolderFlags.Inbox);
  assert.ok(inboxFolder, 'can get the inbox folder');
//  var subFolders = server.rootFolder.subFolders;
});
