
QUnit.module('FolderMessageUpdater test', {
  setup: function() {
    QUnit.Cc = Components.classes;
    QUnit.Ci = Components.interfaces;
    QUnit.Cu = Components.utils;
    QUnit.Cu.import('resource://exchangeEws/commonFunctions.js', QUnit);
    QUnit.Cu.import('resource://exchangeEws/FolderMessageUpdater.js', QUnit);

    QUnit.baseLog = QUnit.commonFunctions.Log
      .getInfoLevelLogger('test_exchangeService');
  },
  teardown: function() {
    delete QUnit.ExchagneService;
    delete QUnit.commonFunctions;
  }
});

QUnit.asyncTest('updateSummaryInfo', function(assert) {
  var converter = QUnit.Cc['@mozilla.org/intl/scriptableunicodeconverter']
    .getService(QUnit.Ci.nsIScriptableUnicodeConverter);
  converter.convertToByteArray(
    'Subject: buildbot success in Bolt on bolt \r\n', {});
  var updater = new QUnit.FolderMessageUpdater({
    server: {
      username: 'liuxiong',
      password: 'abcd.ABCD',
      ewsUrl: 'https://bjmail.kingsoft.com/EWS/exchange.asmx'
    }
  });
  updater.updateSummaryInfo(function(err) {
    assert.ok(!err);
    // QUnit.baseLog.info('the totalCount:' + updater.totalCount);
    // QUnit.start();
    updater._updateMessage(null, function() {
      assert.equal(updater.hasUpdateCount, updater.totalCount);
      QUnit.start();
    });
  });
});
