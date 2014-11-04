
QUnit.module('FindMessagesRequest test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/FindMessagesRequest.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/GetMessageRequest.js', QUnit)
    QUnit.baseLog = QUnit.commonFunctions.Log
      .getInfoLevelLogger('test_FindMessagesRequest');
  },
  teardown: function() {
    delete QUnit.FindMessagesRequest;
    delete QUnit.commonFunctions;
  }
});

QUnit.asyncTest('request messages find', function(assert) {
  var requestConfig = {
    maxReturned: 10,
    serverUrl: 'https://bjmail.kingsoft.com/EWS/exchange.asmx',
    folderBase: 'inbox',
    user: '<username>',
    password: '<password>'
  };

  function getMessages(messages) {
    function msgRequestOK(request, msgInfos) {
      QUnit.baseLog.info(JSON.stringify(msgInfos, null, 2));
      assert.ok(true, 'get the messages');
      QUnit.start();
    }
    function msgRequestError(request, code, msg) {
      QUnit.baseLog.info('the response code is' + code + " message is " + msg);
      assert.ok(false, 'request failed!');
      QUnit.start();
    }

    requestConfig.messages = messages.slice(0, 1);

    var messageRequest = new QUnit.GetMessageRequest(requestConfig,
      msgRequestOK, msgRequestError);
  }

  function requestOK(request, messages) {
    assert.ok(true, 'the find messages request ok!');
    QUnit.baseLog.info(QUnit.dump.parse(messages));
    getMessages(messages);
    // QUnit.start();
  }
  function requestError(request, code, msg) {
    QUnit.baseLog.info('the response code is' + code + " message is " + msg);
    assert.ok(false, 'request failed!');
    QUnit.start();
  }
  var folderRequest = new QUnit.FindMessagesRequest(requestConfig,
    requestOK, requestError);
});
