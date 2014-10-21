
QUnit.module('ExchangeService test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/exchangeService.js', QUnit);

    QUnit.baseLog = QUnit.commonFunctions.Log
      .getInfoLevelLogger('test_exchangeService');
  },
  teardown: function() {
    delete QUnit.ExchagneService;
    delete QUnit.commonFunctions;
  }
});

function prepareExchangeService() {
  var requestConfig = {
    serverUrl: 'https://bjmail.kingsoft.com/EWS/exchange.asmx',
    email: 'liuxiong@kingsoft.com',
    password: 'abcd.ABCD'
  };
  var ex = new QUnit.ExchangeService;
  ex.setCredential(requestConfig.email, requestConfig.password);
  ex.setEwsUrl(requestConfig.serverUrl);
  return ex;
}

QUnit.asyncTest('findFolders', function(assert) {
  var ex = prepareExchangeService();
  ex.findFolders('inbox', function(err, folder) {
    assert.ok(!err, 'findFolders');
    QUnit.start();
  });
});

QUnit.asyncTest('verifyCredential', function(assert) {
  var ex = prepareExchangeService();
  ex.verifyCredential(function(err) {
    assert.ok(!err, 'verifyCredential');
    QUnit.start();
  });
});

QUnit.asyncTest('verifyCredential Failed', function(assert) {
  var ex = prepareExchangeService();
  ex.setCredential('nothing', 'nothing');
  ex.verifyCredential(function(err) {
    assert.ok(err, 'verifyCredential fail with err code:' + err.code);
    QUnit.start();
  });
});

QUnit.asyncTest('getFolder', function(assert) {
  var ex = prepareExchangeService();
  ex.getFolder('inbox', function(err, folder) {
    // QUnit.baseLog.info(JSON.stringify(folder, null, 2));
    assert.ok(!err, 'getFolder');
    QUnit.start();
  });
});

QUnit.asyncTest('findMessages and getMessages', function(assert) {
  var ex = prepareExchangeService();
  ex.findMessagesByFolderName('inbox', 1, 1,  function(err, msgInfos) {
    // QUnit.baseLog.info(JSON.stringify(folder, null, 2));
    assert.ok(!err, 'getFolder');
    ex.getMessages(msgInfos, function(err, messages) {
      assert.ok(!err, 'getMessages');
      assert.ok(Array.isArray(messages));
      QUnit.baseLog.info(JSON.stringify(messages, null, 2));
      QUnit.start();
    })
  });
});

