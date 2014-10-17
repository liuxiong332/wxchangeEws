
QUnit.module('AccountConfig test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://accountConfig/AccountConfig.js', QUnit);
    QUnit.accountLog = QUnit.commonFunctions.Log
      .getInfoLevelLogger('test_AccountConfig');
  },
  teardown: function() {
    delete QUnit.mivIxml2jxon;
    delete QUnit.commonFunctions;
    delete QUnit.accountLog;
  }
});

// QUnit.test('MivIxml2jxon test', function(assert) {
//   var xml2jxon = new QUnit.mivIxml2jxon(
//     '<nsA:root xmlns:nsA="nsA" xmlns:nsB="nsB" nsB:Attr="Attr"/>');
//   var tag1 = xml2jxon.addChildTag('Tag1', 'nsB', 12);

//   // var tagList = xml2jxon.XPath('/nsA:root');
//   // assert.strictEqual(tagList.length, 1);
//   // assert.strictEqual(tagList[0].getAttributeByTag('nsB:Attr'), 'Attr');
//   // assert.strictEqual(tagList[0].getTagIntValue('nsB:Tag1'), 12);

//   var tagList = xml2jxon.XPath('/nsA:root/nsB:Tag1');
//   assert.strictEqual(tagList.length, 1);
// });

QUnit.test('accountConfigConstructor test', function(assert) {
  var dbConfig = {
    domain: 'kingsoft.com',
    recvInfo: {
      protocol: 'imap',
      address: 'kingsoft.com',
      username: 'liuxiong',
      flags: 1,
      port: 110
    },
    sendInfo: {
      protocol: 'imap',
      address: 'kingsoft.com',
      username: 'liuxiong',
      flags: 1,
      port: 110
    },
    num: 100
  };

  function configAssert(incoming, recvInfo) {
    assert.strictEqual(recvInfo.address, incoming.hostname);
    assert.strictEqual(recvInfo.username, incoming.username);
    assert.strictEqual(recvInfo.port, incoming.port);
    assert.strictEqual(incoming.socketType, 2);
  }
  var config = QUnit.accountConfigConstructor(dbConfig);

  var recvInfo = dbConfig.recvInfo;
  var incoming = config.incoming;
  assert.strictEqual(recvInfo.protocol, incoming.type);
  configAssert(incoming, recvInfo);

  var sendInfo = dbConfig.sendInfo;
  var outgoing = config.outgoing;
  configAssert(outgoing, sendInfo);
});

QUnit.asyncTest('ServerVerifier test', function(assert) {
  var serverInfo = {
    type: 'imap',
    hostname: 'imap.qq.com',
    ssl: 2,
    flags: 1,
    port: 993
  };

  QUnit.Cu.import('resource://accountConfig/ServerVerifier.js', QUnit);
  new QUnit.AccountVerifier(serverInfo, function() {
    assert.ok(true);
    QUnit.start();
  }, function() {
    assert.ok(false);
    QUnit.start();
  });
});
