
QUnit.module('erBrowseFolder test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/BrowseFolderRequest.js', QUnit);
    QUnit.baseLog = QUnit.commonFunctions.Log
      .getInfoLevelLogger('test_BrowseFolderRequest');
  },
  teardown: function() {
    delete QUnit.BrowseFolderRequest;
    delete QUnit.commonFunctions;
  }
});

QUnit.test('soapFunctions test', function(assert) {
  QUnit.Cu.import('resource://exchangeEws/soapFunctions.js', QUnit);
  var jxon = QUnit.makeParentFolderIds('parent', {folderBase: 'Inbox'});
  var parentElement = jxon.XPath('nsMessages:parent');
  assert.equal(parentElement.length, 1);
  delete QUnit.makeParentFolderIds;
});

QUnit.asyncTest('request folder find', function(assert) {
  expect(1);
  var requestConfig = {
    serverUrl: 'https://bjmail.kingsoft.com/EWS/exchange.asmx',
    folderBase: 'msgfolderroot',
    user: 'liuxiong',
    password: 'abcd.ABCD'
  };

  function requestOK(request, childFolders) {
    assert.ok(true, 'the find folder request ok!');
    QUnit.baseLog.info(QUnit.dump.parse(childFolders));
    QUnit.start();
  }
  function requestError(request, code, msg) {
    QUnit.baseLog.info('the response code is' + code + " message is " + msg);
    assert.ok(false, 'request failed!');
    QUnit.start();
  }
  var folderRequest = new QUnit.BrowseFolderRequest(requestConfig,
    requestOK, requestError);
});
