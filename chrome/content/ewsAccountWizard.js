
Components.utils.import("resource://exchangeEws/commonFunctions.js");
Components.utils.import("resource:///modules/mailServices.js");

if(!exchangeEws) {
  var exchangeEws = {};
}
if(!exchangeEws.accountWizard)
  exchangeEws.accountWizard = {};


exchangeEws.accountWizard.identityPageUnload = function() {
  var pageData = GetPageData();
  var email = document.getElementById("email").value.trim();
  var matchRes = email.match(/([^@]+)@(([^\.]+)\..*)/);
  if(matchRes == null)
    return false;

  this._email = email;
  this._name = matchRes[1];
  this._host = matchRes[2];
  this._password = document.getElementById("password").value;
  this._ewsUrl = document.getElementById("exchangeEwsUrl").value.trim();

  document.documentElement.canAdvance = true;
  return true;
};

exchangeEws.accountWizard.finishAccount = function() {
  const SERVER_TYPE = "exchange";
  var server = MailServices.accounts.createIncomingServer(this._name,
    this._host, SERVER_TYPE);
  server.password = this._password;
  server.valid = true;
  // Create an account.
  let account = MailServices.accounts.createAccount();

  let identity = MailServices.accounts.createIdentity();
  identity.fullName = this._name;
  identity.email = this._email;
  identity.valid = true;

  account.addIdentity(identity);
  account.incomingServer = server;
  server.valid = true;

  var exchangeServer = server.QueryInterface(Components.interfaces.mivExchangeMsgIncomingServer);
  exchangeServer.ewsUrl = this._ewsUrl;

  MailServices.accounts.saveAccountInfo();
}
