
QUnit.module('MivIxml2jxon test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://interfaces/xml2jxon/mivIxml2jxon.js', QUnit);
    QUnit.baseLog = QUnit.commonFunctions.baseLog;
  },
  teardown: function() {
    delete QUnit.mivIxml2jxon;
    delete QUnit.commonFunctions;
    delete QUnit.baseLog;
  }
});

QUnit.test('MivIxml2jxon test', function(assert) {
  var xml2jxon = new QUnit.mivIxml2jxon(
    '<nsA:root xmlns:nsA="nsA" xmlns:nsB="nsB" nsB:Attr="Attr"/>');
  var tag1 = xml2jxon.addChildTag('Tag1', 'nsB', 12);

  // var tagList = xml2jxon.XPath('/nsA:root');
  // assert.strictEqual(tagList.length, 1);
  // assert.strictEqual(tagList[0].getAttributeByTag('nsB:Attr'), 'Attr');
  // assert.strictEqual(tagList[0].getTagIntValue('nsB:Tag1'), 12);

  var tagList = xml2jxon.XPath('/nsA:root/nsB:Tag1');
  assert.strictEqual(tagList.length, 1);
});
