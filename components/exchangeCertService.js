
/* this class is used to ask for user to recerdential
	when the user credential is bad, checkAndSolveCertProblem will pop a
	window to ask for user retry, if the user canceled, then the credential failed.
 */
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

var EXPORTED_SYMBOLS = ['exchangeCertService'];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import('resource://exchangeEws/commonFunctions.js');
var certLog = commonFunctions.Log.getInfoLevelLogger('exchangeCertService');

function ExchangeBadCertListener2() {
	this.targetSites = {};
	this.userCanceled = {};
}

ExchangeBadCertListener2.prototype = {
	// note the target site has certification problem, targetSite is domain
	notifyCertProblem: function(socketInfo, status, targetSite) {
		this.targetSites[targetSite] = true;
		return true;
	},

	//check the certification has or not problem in the local cache
	checkCertProblem: function(targetSite) {

		if (!targetSite) return false;
		var waitingProblem = false;
		for (var index in this.targetSites) {
			if (this.targetSites[index]) {
				var host = index;
				if (index.indexOf(":") > -1) {
					host = index.substr(0,index.indexOf(":"));
				}
				if ((targetSite.indexOf(index) > -1) ||
					(targetSite.indexOf(host) > -1)) {
					waitingProblem = true;
					break;
				}
			}
		}
		return waitingProblem;
	},

	/*check the certification problem and pop a exception dialog to ask user to
	  cerdential */
	checkAndSolveCertProblem: function(targetSite) {
		var waitingProblem = this.checkCertProblem(targetSite);

		if (waitingProblem) {
			var params = { exceptionAdded: false,
					prefetchCert: true,
					location: targetSite
				};

			var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
	      	                    .getService(Ci.nsIWindowMediator);
			var calWindow = wm.getMostRecentWindow("mail:3pane") ;

			calWindow.openDialog("chrome://pippki/content/exceptionDialog.xul",
					"",
					"chrome,centerscreen,modal",
					params);

			if (params.exceptionAdded) {
				this.targetSites[targetSite] = false;
				delete this.targetSites[targetSite];
				this.userCanceled[targetSite] = false;
				delete this.userCanceled[targetSite];
				return { hadProblem: true, solved: true };
			}
			else {
				this.userCanceled[targetSite] = true;
				return { hadProblem: true, solved: false };
			}
		}
		else {
			return { hadProblem: false };
		}
	},
	// check if user cancel the targetSite in the local cache
	userCanceledCertProblem: function(targetSite) {
		return !!this.userCanceled[targetSite];
	}
};

var exchangeCertService = new ExchangeBadCertListener2;


