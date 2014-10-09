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
    // delete QUnit.log;
  }
});

// QUnit.asyncTest('XmlHttpRequest test', function(assert) {
//   function createXmlHttpRequest() {
//     return QUnit.Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
//   }

//   var xmlReq = createXmlHttpRequest();
//   xmlReq.addEventListener('error', function(event) {
//     QUnit.log.info('ExchangeRequest Error! the event type: '
//       + event.type + '\nreadyState: '
//       + xmlReq.readyState + ', status: ' + xmlReq.status);
//     // QUnit.log.info('the responseText is: ' + xmlReq.responseText);
//     QUnit.log.info('the responseHeader is:' + xmlReq.getAllResponseHeaders());
//     QUnit.start();
//   });

//   xmlReq.addEventListener('load', function(event) {
//     QUnit.log.info('ExchangeRequest Load! the event type: '
//       + event.type + '\nreadyState: '
//       + xmlReq.readyState + ', status: ' + xmlReq.status);
//     QUnit.log.info('the responseHeader is:' + xmlReq.getAllResponseHeaders());
//     QUnit.log.info('the responseText is: ' + xmlReq.responseText);
//     QUnit.start();
//   });
//   var serverUrl = 'https://bjmail.kingsoft.com/EWS/exchange.asmx';
//   xmlReq.open('POST', serverUrl, true, 'liuxiong');
//   xmlReq.channel.notificationCallbacks = {
//     getInterface: function(iid) {
//       if(iid.equals(QUnit.Ci.nsIAuthPrompt2))
//         return this;
//     },

//     promptAuth: function(aChannel, level, authInfo) {
//       QUnit.log.info('promptAuth, the authInfo is:\n' +
//         JSON.stringify(authInfo, null, 4));
//       authInfo.password = 'abcd.ABCD';
//       authInfo.username = 'liuxiong';
//       return true;
//     },

//     asyncPromptAuth: function(aChannel, aCallback, aContext, level, authInfo) {
//       QUnit.log.info('promptAuth, the authInfo is:\n' +
//         JSON.stringify(authInfo, null, 4));
//       var URL = decodeURIComponent(aChannel.URI.scheme + '://' +
//       aChannel.URI.hostPort+aChannel.URI.path);
//       QUnit.log.info('the aChannel.URL is:' + URL + '\n');

//       authInfo.password = 'abcd.ABCD';
//       authInfo.username = 'liuxiong';
//       authInfo.domain = 'bjmail.kingsoft.com';
//       setTimeout(function() {
//         aCallback.onAuthAvailable(aContext, authInfo);
//       }, 100);
//     }
//   }
//   xmlReq.send();
// });

QUnit.test('ExchangeAuthPrompt2 test', function(assert) {
  QUnit.Cu.import('resource://exchangeEws/ExchangeAuthPrompt2.js', QUnit);
  var authPrompt = new QUnit.ExchangeAuthPrompt2;
  var username = 'username', password = 'password';
  var url = 'kingsoft.com', realm = 'basic';
  // authPrompt.getCredentials('username', 'http://kingsoft.com');
  authPrompt.passwordManagerSave(username, password, url, realm);
  var loginInfo = authPrompt.passwordManagerGet(username, url, realm);
  assert.ok(loginInfo.result);
  assert.strictEqual(loginInfo.password, password);
  authPrompt.passwordManagerRemove(username, url, realm);
});
