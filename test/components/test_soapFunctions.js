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
