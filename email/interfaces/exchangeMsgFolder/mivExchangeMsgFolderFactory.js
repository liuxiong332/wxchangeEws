
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;
var components = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");


var mivExchangeMsgFolderFactoryGUID = "35765C1C-CEE4-41D1-B12F-EEB7E74AD0FF";
function mivExchangeMsgFolderFactory() {}

mivExchangeMsgFolderFactory.prototype = {

	QueryInterface : XPCOMUtils.generateQI([Ci.nsIFactory,
				Ci.nsISupports]),

	_className : "mivExchangeMsgFolderFactory",

	classDescription : "Exchange EWS Msg Folder Factory",

	classID : components.ID("{"+mivExchangeMsgFolderFactoryGUID+"}"),
	contractID : "@mozilla.org/rdf/resource-factory;1?name=exchange",
//	flags : Ci.nsIClassInfo.THREADSAFE,
	implementationLanguage : Ci.nsIProgrammingLanguage.JAVASCRIPT,

	// nsISupports getHelperForLanguage(in PRUint32 language);
	getHelperForLanguage: function _getHelperForLanguage(language) {
		return null;
	},


	getInterfaces : function _getInterfaces(count) 
	{
		var ifaces = [Ci.nsIFactory,
				Ci.nsISupports];
		count.value = ifaces.length;
		return ifaces;
	},

	/**
    * Creates an instance of a component.
    *
    * @param aOuter Pointer to a component that wishes to be aggregated
    *               in the resulting instance. This will be nullptr if no
    *               aggregation is requested.
    * @param iid    The IID of the interface being requested in
    *               the component which is being currently created.
    * @param result [out] Pointer to the newly created instance, if successful.
    * @throws NS_NOINTERFACE - Interface not accessible.
    * @throws NS_ERROR_NO_AGGREGATION - if an 'outer' object is supplied, but the
    *                                   component is not aggregatable.
    *         NS_ERROR* - Method failure.
    */
    // void createInstance(in nsISupports aOuter, in nsIIDRef iid,
    //                   [retval, iid_is(iid)] out nsQIResult result);
	createInstance: function(aOuter, iid) {
		return Cc["@kingsoft.com/exchange/msgfolder;1"]
			.createInstance(iid);
	},

	lockFactory: function(lock) {
		return true;
	}
};

var components = [mivExchangeMsgFolderFactory];
if ("generateNSGetFactory" in XPCOMUtils)
  var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);  // Firefox 4.0 and higher
else
  var NSGetModule = XPCOMUtils.generateNSGetModule(components);    // Firefox 3.x
