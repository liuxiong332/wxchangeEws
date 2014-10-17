
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

var EXPORTED_SYMBOLS = ['SocketUtil'];

Cu.import('resource://exchangeEws/commonFunctions.js');
var socketLog = commonFunctions.Log.getInfoLevelLogger('SocketUtil');
/**
 * @param serverInfo:
 *  hostname {String} The DNS hostname to connect to.
 *  port {Integer} The numberic port to connect to on the host.
 *  ssl {Integer} socket type
 *  timeout {Integer} seconds to wait for a server response, then cancel.
 * @commands {Array of String}: protocol commands
 *          to send to the server.
 * @param resultCallback {function(wiredata)} This function will
 *            be called with the result string array from the server
 *            or null if no communication occurred.
 * @param errorCallback {function(e)}
 */
function SocketUtil(serverInfo, commands, sslErrorHandler,
  resultCallback, errorCallback) {
  var hostname = serverInfo.hostname;
  var port = serverInfo.port;
  var ssl = serverInfo.ssl;

  var timeout = 10;
  // assert(commands && commands.length, "need commands");

  var index = 0; // commands[index] is next to send to server
  var initialized = false;
  var aborted = false;

  function _error(e) {
    if (aborted)
      return;
    aborted = true;
    errorCallback(e);
  }
  // In case DNS takes too long or does not resolve or another blocking
  // issue occurs before the timeout can be set on the socket, this
  // ensures that the listener callback will be fired in a timely manner.
  // XXX There might to be some clean up needed after the timeout is fired
  // for socket and io resources.

  // The timeout value plus 2 seconds

  var transportService = Cc["@mozilla.org/network/socket-transport-service;1"]
    .getService(Ci.nsISocketTransportService);
  var NONE = 1;
  var SSL = 2;
  var TLS = 3;
  // @see NS_NETWORK_SOCKET_CONTRACTID_PREFIX
  var socketTypeName = ssl == SSL ? "ssl" : (ssl == TLS ? "starttls" : null);
  var transport = transportService.createTransport([socketTypeName],
    ssl == NONE ? 0 : 1, hostname, port, null);

  transport.setTimeout(Ci.nsISocketTransport.TIMEOUT_CONNECT, timeout);
  transport.setTimeout(Ci.nsISocketTransport.TIMEOUT_READ_WRITE, timeout);
  try {
    transport.securityCallbacks = new BadCertHandler(sslErrorHandler);
  } catch (e) {
    _error(e);
  }
  var outstream = transport.openOutputStream(0, 0, 0);
  var stream = transport.openInputStream(0, 0, 0);
  var instream = Cc["@mozilla.org/scriptableinputstream;1"]
      .createInstance(Ci.nsIScriptableInputStream);
  instream.init(stream);

  var dataListener = {
    data : new Array(),
    onStartRequest: function(request, context) {
      try {
        initialized = true;
        if (!aborted) {
          // Send the first request
          let outputData = commands[index++];
          outstream.write(outputData, outputData.length);
        }
      } catch (e) { _error(e); }
    },
    onStopRequest: function(request, context, status) {
      try {
        instream.close();
        outstream.close();
        resultCallback(this.data.length ? this.data : null);
      } catch (e) { _error(e); }
    },
    onDataAvailable: function(request, context, inputStream, offset, count) {
      try {
        if (!aborted) {
          let inputData = instream.read(count);
          this.data.push(inputData);
          if (index < commands.length) {
            // Send the next request to the server.
            let outputData = commands[index++];
            outstream.write(outputData, outputData.length);
          }
        }
      } catch (e) { _error(e); }
    }
  };

  try {
    var pump = Cc["@mozilla.org/network/input-stream-pump;1"]
        .createInstance(Ci.nsIInputStreamPump);

    pump.init(stream, -1, -1, 0, 0, false);
    pump.asyncRead(dataListener, null);
    return new SocketAbortable(transport);
  } catch (e) { _error(e); }
  return null;
}


function SocketAbortable(transport) {
  this._transport = transport;
}

SocketAbortable.prototype.cancel = function(ex) {
  try {
    this._transport.close(Components.results.NS_ERROR_ABORT);
  } catch (e) {}
};

function BadCertHandler(callback) {
  this._callback = callback;
}

BadCertHandler.prototype = {
  // Suppress any certificate errors
  notifyCertProblem: function(socketInfo, status, targetSite) {
    return this._callback.processCertError(socketInfo, status, targetSite);
  },

  // Suppress any ssl errors
  notifySSLError: function(socketInfo, error, targetSite) {
    return this._callback.processSSLError(socketInfo, error, targetSite);
  },
  // nsISupports
  QueryInterface: function(iid) {
    if(iid.equals(Components.interfaces.nsIBadCertListener2) ||
      iid.equals(Components.interfaces.nsISSLErrorListener))
      return this;
    else {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
  }
};
