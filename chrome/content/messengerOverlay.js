

if(!exchangeEws) {
	var exchangeEws = {};
}
	
exchangeEws.msgOpenAccountWizard = function() {
	window.openDialog("chrome://exchangeEws/content/ewsAccountWizard.xul", "AccountWizard",
                      "chrome,modal,titlebar,centerscreen", {});
}