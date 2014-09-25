
QUnit.module('erFindMessages and erGetMessage test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/erFindMessages.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/erGetMessage.js', QUnit)
    QUnit.baseLog = QUnit.commonFunctions.Log
      .getErrorLevelLogger('test-find-messages');
  },
  teardown: function() {
    delete QUnit.erGetMessageRequest;
    delete QUnit.erFindMessagesRequest;
    delete QUnit.commonFunctions;
  }
});

QUnit.asyncTest('request messages find', function(assert) {
  var requestConfig = {
    maxReturned: 10,
    serverUrl: 'https://bjmail.kingsoft.com/EWS/exchange.asmx',
    folderBase: 'inbox',
    user: 'liuxiong',
    password: 'abcd.ABCD'
  };

  function getMessages(messages) {
    function msgRequestOK(request, msgInfos) {
      assert.ok(true, 'get the messages');
      QUnit.start();
    }
    function msgRequestError(request, code, msg) {
      QUnit.baseLog.info('the response code is' + code + " message is " + msg);
      assert.ok(false, 'request failed!');
      QUnit.start();
    }

    requestConfig.messages = messages.slice(0, 1);

    var messageRequest = new QUnit.erGetMessageRequest(requestConfig,
      msgRequestOK, msgRequestError);
  }

  function requestOK(request, messages) {
    assert.ok(true, 'the find messages request ok!');
    QUnit.baseLog.info(QUnit.dump.parse(messages));
    getMessages(messages);
  }
  function requestError(request, code, msg) {
    QUnit.baseLog.info('the response code is' + code + " message is " + msg);
    assert.ok(false, 'request failed!');
    QUnit.start();
  }
  var folderRequest = new QUnit.erFindMessagesRequest(requestConfig,
    requestOK, requestError);
});
