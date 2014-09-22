
QUnit.module('erFindMessages test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/erFindMessages.js', QUnit);
    QUnit.baseLog = QUnit.commonFunctions.baseLog;
  },
  teardown: function() {
    delete QUnit.erFindMessagesRequest;
    delete QUnit.commonFunctions;
  }
});

QUnit.asyncTest('request messages find', function(assert) {
  expect(1);
  var requestConfig = {
    maxReturned: 10,
    serverUrl: 'https://bjmail.kingsoft.com/EWS/exchange.asmx',
    folderBase: 'inbox',
    user: 'liuxiong',
    password: 'abcd.ABCD'
  };

  function requestOK(request, messages) {
    assert.ok(true, 'the find messages request ok!');
    QUnit.baseLog.info(QUnit.dump.parse(messages));
    QUnit.start();
  }
  function requestError(request, code, msg) {
    QUnit.baseLog.info('the response code is' + code + " message is " + msg);
    assert.ok(false, 'request failed!');
    QUnit.start();
  }
  var folderRequest = new QUnit.erFindMessagesRequest(requestConfig,
    requestOK, requestError);
});
