var Cu = Components.utils;
Cu.import('resource://accountConfig/DBReader.js');

/**
 * @param configs: the array of AccountConfig
 * @param successCallback: function(config)
 */
function verifyEmail(configs, successCallback, errorCallback) {
  function successGetConfig(verifier) {
    successCallback(verifier.config);
  }

  function startNewVerify() {
    if(configs.length === 0) {
      return errorCallback();
    }
    var config = configs.shift();
    config.startVerify(successCallback, startNewVerify);
  }
  startNewVerify();
}

function fetchConfigFromDb(domain, successCallback, errorCallback) {
  var configDbPath = "Extral_Provider.db";
  try {
    successCallback(DBReader(domain, configDbPath));
  } catch(e) {
    errorCallback(e);
  }
}
