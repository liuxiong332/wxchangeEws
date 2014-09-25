
QUnit.module('erGetFolder test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/erGetFolder.js', QUnit);
    QUnit.baseLog = QUnit.commonFunctions.baseLog;
  },
  teardown: function() {
    delete QUnit.erGetFolderRequest;
    delete QUnit.commonFunctions;
  }
});

QUnit.asyncTest('get folder info', function(assert) {
  expect(1);
  var requestConfig = {
    serverUrl: 'https://bjmail.kingsoft.com/EWS/exchange.asmx',
    folderBase: 'inbox',
    user: 'liuxiong',
    password: 'abcd.ABCD'
  };

  function requestOK(request, folderInfo) {
    assert.ok(true, 'the find folder request ok!');
    QUnit.baseLog.info(QUnit.dump.parse(folderInfo));
    QUnit.start();
  }
  function requestError(request, code, msg) {
    QUnit.baseLog.info('the response code is' + code + " message is " + msg);
    assert.ok(false, 'request failed!');
    QUnit.start();
  }
  var folderRequest = new QUnit.erGetFolderRequest(requestConfig,
    requestOK, requestError);
});
