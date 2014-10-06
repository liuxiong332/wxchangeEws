
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

QUnit.test('RegStrExecutor test', function(assert) {
  var executor = new QUnit.RegStrExecutor('hello world');
  assert.ok(executor.tryExecute(/hello/g));
  assert.ok(executor.execute(/hello/g));
  assert.ok(executor.execute(/world/g));
});

QUnit.test('XmlProcessor test', function(assert) {
  var headerStr = '<?xml version="1.0" encoding="UTF-8"?>';
  assert.ok((new QUnit.XmlProcessor(headerStr)).processHeader());

  assert.equal((new QUnit.XmlProcessor('</note>')).checkTagOrTextContent(),
    QUnit.XmlProcessor.END_TAG);
  assert.equal((new QUnit.XmlProcessor('<note>')).checkTagOrTextContent(),
    QUnit.XmlProcessor.NEW_TAG);
  assert.equal((new QUnit.XmlProcessor('note>')).checkTagOrTextContent(),
    QUnit.XmlProcessor.TEXT_CONTENT);

  var xmlStr = '<?xml version="1.0" encoding="UTF-8"?>' +
  '<note attr="AttrValue">' +
    '<to> Tove</to>' +
  '</note>';
  var processor = new QUnit.XmlProcessor(xmlStr);
  processor.processHeader();
  var xmlObj = {};
  processor.processTagHeader(xmlObj);
  assert.strictEqual(xmlObj.tagName, 'note');

  xmlObj.explodeAttribute = function(ns, attrName, attrValue) {
    assert.ok(!ns);
    assert.strictEqual(attrName, 'attr');
    assert.strictEqual(attrValue, 'AttrValue');
  };
  assert.strictEqual(QUnit.XmlProcessor.TAG_CLOSED,
    processor.processTagAttributeAndEnd(xmlObj));

  //analyze <to> Tove </to>
  assert.strictEqual(processor.checkTagOrTextContent(),
    QUnit.XmlProcessor.NEW_TAG);
  processor.processTagHeader(xmlObj);
  assert.strictEqual(xmlObj.tagName, 'to');
  assert.strictEqual(QUnit.XmlProcessor.TAG_CLOSED,
    processor.processTagAttributeAndEnd(xmlObj));

  assert.strictEqual(processor.checkTagOrTextContent(),
    QUnit.XmlProcessor.TEXT_CONTENT);
  assert.strictEqual(processor.processTextContent(), ' Tove',
    'get text content');
  assert.strictEqual(processor.checkTagOrTextContent(),
    QUnit.XmlProcessor.END_TAG, 'check end tag to');
  processor.processEndTag({tagName: 'to'});

  assert.strictEqual(processor.checkTagOrTextContent(),
    QUnit.XmlProcessor.END_TAG, 'check end tag note');
  processor.processEndTag({tagName: 'note'});

  function xmlObjConstructe() {
    return {
      explodeAttribute: xmlObj.explodeAttribute,
      addChildTagObject: function() {},
      addToContent: function(content) {
        assert.strictEqual(content, ' Tove');
      }
    };
  }
  (new QUnit.XmlProcessor(xmlStr)).processXmlObj(xmlObjConstructe);
});

QUnit.test('XmlProcessor NS test', function(assert) {
  var xmlStr = '<?xml version="1.0" encoding="UTF-8"?>' +
  '<xml:note ns:attr="AttrValue">' +
    '<to> Tove</to>' +
  '</xml:note>';

  function xmlObjConstructe() {
    return {
      explodeAttribute: function(ns, attrName, attrValue) {
        assert.strictEqual(ns, 'ns');
        assert.strictEqual(attrName, 'attr');
        assert.strictEqual(attrValue, 'AttrValue');
      },
      addChildTagObject: function(obj) {
        assert.strictEqual(obj.tagName, 'to');
        assert.ok(!obj.nameSpace);
      },
      addToContent: function(content) {
        assert.strictEqual(content, ' Tove');
      }
    };
  }
  var obj = (new QUnit.XmlProcessor(xmlStr)).processXmlObj(xmlObjConstructe);
  assert.strictEqual(obj.nameSpace, 'xml');
  assert.strictEqual(obj.tagName, 'note');
});

QUnit.test('Xml2jxonObj processor', function(assert) {
  var xmlStr = '<?xml version="1.0" encoding="UTF-8"?>' +
  '<xml:note ns:attr="AttrValue">' +
    '<to> Tove</to>' +
  '</xml:note>';
  var xmlObj = new QUnit.Xml2jxonObj(xmlStr);
  assert.strictEqual(xmlObj.nameSpace, 'xml');
  assert.strictEqual(xmlObj.tagName, 'note');
  assert.strictEqual(xmlObj.getAttribute('ns:attr'), 'AttrValue');
  assert.strictEqual(xmlObj.getChildTagValue('to'), ' Tove');

  var childTag = xmlObj.getChildTag('to');
  assert.deepEqual([childTag], xmlObj.getChildTags('to'));
  assert.ok(childTag);
  assert.strictEqual(childTag.getValue(), ' Tove');
  childTag.setAttribute('attr1', 'value');
  assert.strictEqual(xmlObj.getAttributeByChildTag('to', 'attr1'), 'value');

  var newTag = xmlObj.addChildTag('from', 'xml', 'who am i');
  assert.equal(newTag, xmlObj.getChildTag('xml:from'));

  var newObj = new QUnit.Xml2jxonObj(xmlObj.toString());
  assert.deepEqual(newObj, xmlObj);
});
