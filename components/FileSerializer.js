
var Cu = Components.utils;
var Ci = Components.interfaces;
var Cc = Components.classes;

Cu.import('resource://exchangeEws/commonFunctions.js');
var updateLog = commonFunctions.Log.getInfoLevelLogger('FileSerializer');

var EXPORTED_SYMBOLS = ["FileSerializer"];

function FileSerializer(filePath) {
	var file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
  file.initWithPath(filePath);
  if(!file.exists())  file.create(file.NORMAL_FILE_TYPE, 0666);
  this.file = file;
}

FileSerializer.converter = (function() {
  var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
    .getService(Ci.nsIScriptableUnicodeConverter);
  converter.charset = 'UTF-8';
  return converter;
}());

FileSerializer.prototype = {
  serialize: function(str) {
    var fileStream = Cc['@mozilla.org/network/file-output-stream;1']
      .createInstance(Ci.nsIFileOutputStream);
    fileStream.init(this.file, -1, -1, 0);

    var binaryStream = Cc['@mozilla.org/binaryoutputstream;1']
      .createInstance(Ci.nsIBinaryOutputStream);
    binaryStream.setOutputStream(fileStream);

    var bytes = FileSerializer.converter.convertToByteArray(str, {});
    binaryStream.writeByteArray(bytes, bytes.length);

    binaryStream.close();
    fileStream.close();
  },

  deserialize: function() {
    var fileStream = Cc['@mozilla.org/network/file-input-stream;1']
      .createInstance(Components.interfaces.nsIFileInputStream);
    fileStream.init(this.file, 1, 0, 0);

    var binaryStream = Cc['@mozilla.org/binaryinputstream;1']
      .createInstance(Ci.nsIBinaryInputStream);
    binaryStream.setInputStream(fileStream);

    var bytes = binaryStream.readByteArray(binaryStream.available());
    var str = FileSerializer.converter.convertFromByteArray(bytes, bytes.length);

    binaryStream.close();
    fileStream.close();

    return str;
  },

  remove: function() {
    this.file.remove(true);
  }
}
