

if(!exchangeEws)
  exchangeEws = {};
if(!exchangeEws.accountWizard)
  exchangeEws.accountWizard = {};

exchangeEws.accountWizard.globalFunctions = 
  Components.classes["@1st-setup.nl/global/functions;1"].getService(Components.interfaces.mivFunctions);
  
//AccountData for the exchange Account Data
exchangeEws.accountWizard._ewsData = {
  'incomingServer': {
    'type': 'exchange',
    'ServerType-exchange': {
      'useMail': true,
    },
    'loginAtStartUp': true,
    'port': 443,
    'socketType': 3,
    'biffMinutes': 5,
    'doBiff': true,
    'protocolInfo': { 'serverIID': Components.interfaces.msqIEwsIncomingServer },
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
  return true;
}; 

exchangeEws.accountWizard.overrideAccountWizard = function() {
  // override PageDataToAccountData to copy ews-specific information
  this.oldPageDataToAccountData = PageDataToAccountData;
  PageDataToAccountData = function ewsPageDataToAccountData(pageData, accountData) {
    exquilla.AW.oldPageDataToAccountData(pageData, accountData);
    if (accountData.incomingServer.type == 'exchange') {
      if (!accountData.incomingServer["ServerType-exchange"])
        accountData.incomingServer["ServerType-exchange"] = {};

      // add the ewsURL to the server
      if (pageData.server.ewsURL)
        accountData.incomingServer["ServerType-exchange"].ewsURL = pageData.server.ewsURL.value;

      // add domain if defined
      if (pageData.login && pageData.login.domain)
        accountData.incomingServer["ServerType-exchange"].domain = pageData.login.domain.value;

      // set the appropriate user name
      if (pageData.login.username && pageData.login.username.value.length)
        accountData.incomingServer.username = pageData.login.username.value;
      else
        accountData.incomingServer.username = pageData.identity.email.value;

      if (pageData.server.useMail)
        accountData.incomingServer["ServerType-exchange"].useMail = pageData.server.useMail.value;
      if (pageData.server.useAB)
        accountData.incomingServer["ServerType-exchange"].useAB = pageData.server.useAB.value;
      if (pageData.server.useCalendar)
        accountData.incomingServer["ServerType-exchange"].useCalendar = pageData.server.useCalendar.value;
    }
  };
  // override setDefaultCopiesAndFoldersPrefs to prevent creation of DBs for unused folders
  this.oldSetDefaultCopiesAndFoldersPrefs = setDefaultCopiesAndFoldersPrefs;
  setDefaultCopiesAndFoldersPrefs = function exquillaSetDefaultCopiesAndFoldersPrefs(identity, server, accountData)
  {
    if (server.type == 'exquilla')
    {
      return ewsSetDefaultCopiesAndFoldersPrefs(identity, server, accountData);
    }
    else
    {
      return this.oldSetDefaultCopiesAndFoldersPrefs(identity, server, accountData);
    }
  }
};

window.addEventListener("load", function(event) {
  exchangeEws.accountWizard.overrideAccountWizard(event);
}, false);