
QUnit.module('AutoDiscoverRequest test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/AutoDiscoverRequest.js', QUnit);
    QUnit.discoverLog = QUnit.commonFunctions.Log
      .getInfoLevelLogger('test_AutoDiscoverRequest');
  },
  teardown: function() {
    delete QUnit.commonFunctions;
    delete QUnit.discoverLog;
  }
});

QUnit.asyncTest('discover test', function(assert) {
  var requestConfig = {
    mailbox: 'liuxiong@kingsoft.com',
    user: 'liuxiong',
    password: 'abcd.ABCD'
  };
  function onOk(request, ewsUrl) {
    assert.ok(true, 'get ews url');
    QUnit.discoverLog.info('get ews url: ' + ewsUrl);
    QUnit.start();
  }

  function onFail(request, code, msg) {
    assert.ok(false);
    QUnit.start();
  }
  new QUnit.AutoDiscoverRequest(requestConfig, onOk, onFail);
});

