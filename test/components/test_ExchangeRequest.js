QUnit.module('ExchangeRequest test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.log = QUnit.commonFunctions.Log
      .getInfoLevelLogger('test_ExchangeRequest');
  },
  teardown: function() {
    delete QUnit.commonFunctions;
    delete QUnit.log;
  }
});

// QUnit.asyncTest('XmlHttpRequest test', function(assert) {
//   QUnit.Cu.import('resource://exchangeEws/ExchangeRequest.js', QUnit);
//   var request = new QUnit.ExchangeRequest({
//     user: 'liuxiong',
//     password: 'abcd.ABCD'
//   }, onSuccess, onError);
//   function onSuccess() {
//     QUnit.start();
//   }
//   function onError(request, code, msg) {
//     QUnit.log.info('the code is:' + code + ',error msg is:' + msg);
//     assert.ok(code);
//     assert.ok(msg);
//     QUnit.start();
//   }
//   request.sendRequest('', 'https://bjmail.kingsoft.com/EWS/exchange.asmx');
// });

QUnit.test('ExchangeAuthPromptService test', function(assert) {
  QUnit.Cu.import('resource://exchangeEws/exchangeAuthPromptService.js', QUnit);
  var authPrompt = QUnit.exchangeAuthPromptService;
  var username = 'username', password = 'password';
  var url = 'kingsoft.com', realm = 'basic';
  // authPrompt.getCredentials('username', 'http://kingsoft.com');
  authPrompt.passwordManagerSave(username, password, url, realm);
  var loginInfo = authPrompt.passwordManagerGet(username, url, realm);
  assert.ok(loginInfo.result);
  assert.strictEqual(loginInfo.password, password);
  authPrompt.passwordManagerRemove(username, url, realm);
});
