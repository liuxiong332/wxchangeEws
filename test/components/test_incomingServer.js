QUnit.module('nsIMstIncomingServer test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;

    QUnit.Cu.import('resource:///modules/mailServices.js', QUnit);
  },
  teardown: function() {
    delete QUnit.MailServices;
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

  var identity = QUnit.MailServices.accounts.createIdentity();
  identity.fullName = config.username;
  identity.email = config.email;
  identity.valid = true;

  var account = QUnit.MailServices.accounts.createAccount();
  account.addIdentity(identity);
  account.incomingServer = server;

  assert.ok(server.rootFolder, 'can get the root folder');
  var subFolders = server.rootFolder.subFolders;
});
