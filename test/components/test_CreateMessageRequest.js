QUnit.module('CreateMessageRequest test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/CreateMessageRequest.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/FileSerializer.js', QUnit);
    QUnit.createLog = QUnit.commonFunctions.Log
      .getInfoLevelLogger('test_CreateMessageRequest');
  },
  teardown: function() {
    delete QUnit.commonFunctions;
    delete QUnit.log;
  }
});


QUnit.asyncTest('CreateMessage test', function(assert) {
  var currDir = QUnit.Cc["@mozilla.org/file/directory_service;1"]
    .getService(QUnit.Ci.nsIDirectoryServiceProvider)
    .getFile("CurWorkD", {});
  currDir.append('components');
  currDir.append('test.eml');
  var fileSerializer = new QUnit.FileSerializer(currDir.path);
  var requestConfig = {
    serverUrl: 'https://bjmail.kingsoft.com/EWS/exchange.asmx',
    msgInfo: {
      subject: 'Nothing',
      body: {
        content: 'Hello World!',
        bodyType: 'Text'
      },
      toRecipients: {
        emailAddress: 'liuxiong@kingsoft.com',
        name: 'liuxiong'
      }
    },
    user: 'liuxiong',
    password: 'abcd.ABCD'
  };

  function onOk() {
    assert.ok(true, 'create message ok');
    QUnit.start();
  }

  function onFail(request, code, msg) {
    QUnit.createLog.info('the error code:' + code + ',the msg:' + msg);
    assert.ok(false, 'create message fail');
    QUnit.start();
  }

  new QUnit.CreateMessageRequest(requestConfig, onOk, onFail);
});
