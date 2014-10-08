QUnit.module('soap Functions test', {
  setup: function() {
    QUnit.Cu = Components.utils;
    QUnit.Cu.import("resource://exchangeEws/soapFunctions.js", QUnit);
  },
  teardown: function() {
    delete QUnit.makeParentFolderIds;
  }
});

QUnit.test('makeParentFolderIds ', function(assert) {
  var jxonObj = QUnit.makeParentFolderIds('Parent', {folderBase: 'Inbox'});
  var parentElements = jxonObj.XPath('/nsMessages:Parent');
  assert.equal(parentElements.length, 1, 'get parent element');

  var folderElements = jxonObj.XPath(
    '/nsMessages:Parent/nsTypes:DistinguishedFolderId');
  assert.equal(folderElements.length, 1, 'get folder element');
  assert.strictEqual(folderElements[0].getAttribute('Id'), 'Inbox');
});

QUnit.test('makeSoapMessage ', function(assert) {
  QUnit.Cu.import('resource://exchangeEws/Xml2jxonObj.js', this);
  QUnit.Cu.import('resource://exchangeEws/soapNSDef.js', this);
  var newObj = new this.Xml2jxonObj('nothing');
  var msg = QUnit.makeSoapMessage(newObj);

  var msgObj = this.Xml2jxonObj.createFromXML(msg);
  assert.strictEqual(msgObj.getNamespace('nsSoap'), this.soapNSDef.nsSoapStr);
  assert.deepEqual(msgObj.XPath('/nsSoap:Envelope/nsSoap:Body/nothing'),
    [newObj]);
});
