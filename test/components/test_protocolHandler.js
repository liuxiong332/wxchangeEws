QUnit.module('protocol handler test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;

    // QUnit.log = QUnit.commonFunctions.Log
    //   .getInfoLevelLogger('test-protocolhandler');
  },
  teardown: function() {
    delete QUnit.MailServices;
    delete QUnit.commonFunctions;
  }
});


QUnit.test('test the protocolHandler module', function(assert) {
  var handler = QUnit.Cc['@mozilla.org/network/protocol;1?name=exchange']
    .getService(QUnit.Ci.nsIProtocolHandler);

  assert.ok(handler, 'get the handler service');
});
