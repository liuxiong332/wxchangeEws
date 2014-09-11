

if(!exchangeEws) {
  var exchangeEws = {};
}
if(!exchangeEws.accountWizard)
  exchangeEws.accountWizard = {};

//AccountData for the exchange Account Data
exchangeEws.accountWizard._ewsData = {
  'incomingServer': {
    'type': 'exchange',
    'ServerType-exchange': {
      'ewsUrl': '',
    },
    'hostName': null,
    'loginAtStartUp': true,
    'port': 443,
    'socketType': 3,
    'biffMinutes': 5,
    'doBiff': true,
    'protocolInfo': { 
      'serverIID': Components.interfaces.mivExchangeMsgIncomingServer 
    },
  },
  'identity': {
    'FccFolder': 'Sent Items'
  },
  'emailProviderName': 'EWS',
};


exchangeEws.accountWizard.onAccountWizardLoad = function() { 
  //set the account type is otheraccount type
  function setAccountTypeData() 
  {
    var pageData = GetPageData();
    setPageData(pageData, "accounttype", "mailaccount",false);
    setPageData(pageData, "accounttype", "newsaccount", false);
    // Other account type, e.g. Movemail
    setPageData(pageData, "accounttype", "otheraccount", true);
  }

  onAccountWizardLoad();    //invoke the standard AccountWizardLoad 
  var pageData = GetPageData();
  SetCurrentAccountData(this._ewsData);
  AccountDataToPageData(this._ewsData, pageData);
  setAccountTypeData();
  dump(pageData);
  return true;
}

exchangeEws.accountWizard.identityPageUnload = function() {
  var pageData = GetPageData();
  var email = document.getElementById("email").value.trim();
  var matchRes = email.match(/([^@]+)@(([^\.]+)\..*)/);
  if(matchRes == null)
    return false;

  var name = matchRes[1];
  var host = matchRes[2];
  var domain = matchRes[3];
  var password = document.getElementById("password").value;
  var ewsUrl = document.getElementById("exchangeEwsUrl").value.trim();

  setPageData(pageData, "identity", "email", email);
  setPageData(pageData, "identity", "fullName", name);
  setPageData(pageData, "login", "username", name);
  setPageData(pageData, "login", "domain", domain);
  setPageData(pageData, "login", "password", password);
  setPageData(pageData, "login", "savePassword", true);
  setPageData(pageData, "server", "hostname", host);
  setPageData(pageData, "server", "ewsUrl", ewsUrl);
  document.documentElement.canAdvance = true;

  return true;
}; 

exchangeEws.accountWizard.overrideAccountWizard = function() {
  // override PageDataToAccountData to copy ews-specific information
  var oldPageDataToAccountData = PageDataToAccountData;
  PageDataToAccountData = function ewsPageDataToAccountData(pageData, accountData) {
    oldPageDataToAccountData(pageData, accountData);
    if (accountData.incomingServer.type === 'exchange') {
      if (!accountData.incomingServer["ServerType-exchange"])
        accountData.incomingServer["ServerType-exchange"] = {};

      // add the ewsURL to the server
      if (pageData.server.ewsUrl)
        accountData.incomingServer["ServerType-exchange"].ewsUrl = pageData.server.ewsUrl.value;

      // set the appropriate user name
      if (pageData.login.username && pageData.login.username.value.length)
        accountData.incomingServer.username = pageData.login.username.value;
      else
        accountData.incomingServer.username = pageData.identity.email.value;
 
    }
  };

};

window.addEventListener("load", function(event) {
  exchangeEws.accountWizard.overrideAccountWizard(event);
}, false);