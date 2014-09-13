
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

  this._name = matchRes[1];
  this._host = matchRes[2];
  this._password = document.getElementById("password").value;
  this._ewsUrl = document.getElementById("exchangeEwsUrl").value.trim();
 
  document.documentElement.canAdvance = true;
  return true;
}; 

exchangeEws.accountWizard.finishAccount = function() {
  const SERVER_TYPE = "exchange";
  server = MailServices.accounts.createIncomingServer(this._name, this._host, SERVER_TYPE);
  CommonFunctions.baseLog.info("CreateIncomingServer username: " + this._name + 
    " host: " + this._host );
  // Create an account.
  let account = MailServices.accounts.createAccount();
  CommonFunctions.baseLog.info("CreateAccount successfully!");
  // only create an identity for this account if we really have one
  // (use the email address as a check)
  let identity = MailServices.accounts.createIdentity();
  CommonFunctions.baseLog.info("CreateAccount Identity!");
  account.addIdentity(identity);
  // Set the new account to use the new server.
  CommonFunctions.baseLog.info("add server into the account!");
  account.incomingServer = server;
  server.valid = true;

  var exchangeServer = server.QueryInterface(Components.interfaces.mivExchangeMsgIncomingServer);
  exchangeServer.ewsUrl = this._ewsUrl;

  MailServices.accounts.saveAccountInfo();
}