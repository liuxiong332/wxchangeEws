
Components.utils.import('resource://exchangeEws/commonFunctions.js');
var log = commonFunctions.Log.getInfoLevelLogger('xml2jxon');

var EXPORTED_SYMBOLS = ['Xml2jxonObj', 'XmlProcessor', 'RegStrExecutor'];

function RegStrExecutor(str) {
	this.str = str;
	this.matchIndex = 0;
}

RegStrExecutor.prototype.execute = function(regexp) {
	regexp.lastIndex = this.matchIndex;
	var res = regexp.exec(this.str);
	res && (this.matchIndex = regexp.lastIndex);
	return res;
};

RegStrExecutor.prototype.tryExecute = function(regexp) {
	regexp.lastIndex = this.matchIndex;
	return regexp.exec(this.str);
};

function XmlProcessor(str) {
	this.strExecutor = new RegStrExecutor(str);
}

XmlProcessor.TAG_CLOSED = 0;		/*< tag end with >*/
XmlProcessor.TAG_END_CLOSED = 1; /*< tag end with />*/
XmlProcessor.NEW_TAG = 0;
XmlProcessor.END_TAG = 1;
XmlProcessor.TEXT_CONTENT = 2;

XmlProcessor.prototype = {
	processHeader: function() {
		var headerReg = /^[ ]*<\?xml([ ]+\w+=\".+?\")+[ ]*\?>/g;
		return this.strExecutor.execute(headerReg);
	},

	processTagHeader: function(xmlObj) {
		var tagHeadReg = /\s*<(?:(\w+):)?(\w+)/g;
		var res = this.strExecutor.execute(tagHeadReg);
		if(!res)	throw new Error('the tag header parse error');
		xmlObj.nameSpace = res[1];
		xmlObj.tagName = res[2];
	},

	processTagAttributeAndEnd: function(xmlObj) {
		var attrOrEndReg = /(?:\s+(?:(\w+):)?(\w+)\=\"(.*?)\")|>|\/>/g;
		while(true) {
			var res = this.strExecutor.execute(attrOrEndReg);
			if(!res)	throw new Error('cannot find the matched end tag');
			switch(res[0]) {
				case '>': 	return XmlProcessor.TAG_CLOSED;
				case '/>': 	return XmlProcessor.TAG_END_CLOSED;
			}
			xmlObj.explodeAttribute(res[1], res[2], res[3]);
		}
	},

	checkTagOrTextContent: function() {
		var startReg = /\s*((<\/)|(<(?!\/))|[^<])/gy;
		log.info('the text is:' + this.strExecutor.str.substring(this.strExecutor.matchIndex));
		var res = this.strExecutor.tryExecute(startReg);
		if(res)	log.info('the new tag is: ' + res[1]);
		if(!res)	return null;
		switch(res[1]) {
			case '</': 	return XmlProcessor.END_TAG;
			case '<': 	return XmlProcessor.NEW_TAG;
			default: 		return XmlProcessor.TEXT_CONTENT;
		}
	},

	processEndTag: function(xmlObj) {
		var endTagReg = /<\/(?:(\w+):)?(\w+)>/g;
		var res = this.strExecutor.execute(endTagReg);

		if(!res || (res[1] !== xmlObj.nameSpace) || (res[2] !== xmlObj.tagName))
			throw new Error('the end tag is not matched');
	},

	processTextContent: function() {
		var textReg = /[^<]+/g;
		var res = this.strExecutor.execute(textReg);
		if(!res)	return null;
		return res[0];
	},
  /*xmlObjConstructor is function that can create new instance of xmlobj
  */
	processXmlObj: function(xmlObjConstructor) {
		this.processHeader();
		var xmlObj = xmlObjConstructor();
		var isTagEnd = false;

		this.processTagHeader(xmlObj);
		var endRes = this.processTagAttributeAndEnd(xmlObj);
		if(endRes === XmlProcessor.TAG_END_CLOSED)
			return xmlObj;
		else if(endRes === XmlProcessor.TAG_CLOSED) {
			while(!isTagEnd) {
				switch(this.checkTagOrTextContent()) {
					case XmlProcessor.END_TAG: {
						this.processEndTag(xmlObj);
						isTagEnd = true;	//find the end tag
						break;
					}
					case XmlProcessor.NEW_TAG:
						xmlObj.addChildTagObject(this.processXmlObj(xmlObjConstructor));
						break;
					case XmlProcessor.TEXT_CONTENT:
						xmlObj.addToContent(this.processTextContent());
						break;
				}
			}
			return xmlObj;
		}
	}
};

function convertSpecialCharatersFromXML(strXml) {
	// Convert special characters
	return strXml.replace(/&(quot|apos|lt|gt|amp);/g, function (str, r1) {
		var result = str;
		switch (r1) {
			case "amp": 	result = "&"; 	break;
			case "quot": 	result = '"'; 	break;
			case "apos": 	result = "'"; 	break;
			case "lt": 		result = "<"; 	break;
			case "gt": 		result = ">"; 	break;
		}
		return result;
	});
}

function convertSpecialCharatersToXML(str) {
	// Convert special characters
	return str.replace(/(&|\x22|\x27|<|>)/g, function (str, r1) {
		var result = str;
		switch (r1) {
			case "&": result = "&amp;"; 	break;
			case '"': result = "&quot;"; 	break;
			case "'": result = "&apos;"; 	break;
			case "<": result = "&lt;"; 		break;
			case ">": result = "&gt;"; 		break;
		}
		return result;
	});
}

function Xml2jxonObj(xmlStr) {
	if(xmlStr) {
		var processor = new XmlProcessor(xmlStr);
		return processor.processXmlObj(Xml2jxonObj.constructor);
	}
  this.nameSpaces = {};
  this.tags = {};
  this.attr = {};
  this.content = [];
}

Xml2jxonObj.constructor = function() {
	return new Xml2jxonObj;
};

Xml2jxonObj.prototype = {
	/*add the text into the value content*/
	addToContent: function(text) {
    this.content.push(convertSpecialCharatersFromXML(text));
  },

  explodeAttribute: function(attrNs, attrName, attrValue) {
    if (attrNs === "xmlns") {
      this.addNameSpace(attrName, attrValue);
    } else if(!attrNs && attrName === 'xmlns') {
      this.addNameSpace("_default_" , attrValue);
    } else {
    	var attrTag = attrNs? attrNs + ':' + attrName : attrName;
      this.attr[attrTag] = convertSpecialCharatersFromXML(attrValue);
    }
  },

  getNameSpace: function(nsAlias) {
    !nsAlias && (nsAlias = '_default_');
    return this.nameSpaces[nsAlias];
  },
  addNameSpace: function(nsAlias, nsUri) {
    this.nameSpaces[nsAlias] = nsUri;
  },

  addChildTagObject: function(childTagObj) {
  	var tagNs = childTagObj.nameSpace;
    var tagName = tagNs?tagNs + ':' + childTagObj.tagName : childTagObj.tagName;
    if (!this.tags[tagName]) {
      this.tags[tagName] = childTagObj;
    } else if (!Array.isArray(this.tags[tagName])) {
      let prevTag = this.tags[tagName];
      this.tags[tagName] = [prevTag, childTagObj];
    } else {
    	this.tags[tagName].push(childTagObj);
    }
  },

  addChildTag: function(tagName, ns, textValue) {
    var newObj = new Xml2jxonObj;
    newObj.nameSpace = ns;
    newObj.tagName = tagName;
    newObj.content.push(textValue);
    this.addChildTagObject(newObj);
    return newObj;
  },

  setAttribute: function(attrTag, attrValue) {
    this.attr[attrTag] = attrValue;
  },

  getAttribute: function(attrTag, defValue) {
    return this.attr[attrTag] || defValue;
  },

  getAttributeByChildTag: function(tagName, attrTag, attrDefValue) {
    var targetTag = this.getChildTag(tagName);
    if(targetTag)  return targetTag.getAttribute(attrTag, attrDefValue);
    return attrDefValue;
  },

  getChildTag: function(tagName) {
    return this.tags[tagName];
  },
  getChildTags: function(tagName)  {
    var tagElements = this.getChildTag(tagName);
    if (!tagElements) return [];
    if (Array.isArray(tagElements)) return tagElements;
    return [tagElements];
  },

  getChildTagValue: function(tagName, defValue) {
    var tagElement = this.getChildTag(tagName);
    return tagElement? tagElement.getValue() : defValue;
  },

  getValue: function() {
    var content = this.content;
    return content && content[0]? content[0]: '';
  },

  attributeToString: function() {
  	var str = '';
  	var attrMap = this.attr;
  	for(var attr in attrMap) {
  		str += ' ' + attr + '="' + attrMap[attr] + '"';
  	}
  	return str;
  },

  nameSpacesToString: function() {
  	var str = '';
  	for(var ns in this.nameSpaces) {
  		if(ns === '_default_')
  			str += ' xmlns="' + this.nameSpaces[ns] + '"';
  		else
  			str += ' xmlns:' + ns + '="' + this.nameSpaces[ns] + '"';
  	}
  	return str;
  },

  tagsToString: function() {
  	var tagElements = this.tags;
  	var str = '';
		for(var tagName in tagElements) {
  		if(Array.isArray(tagElements[tagName])) {
  			tagElements[tagName].forEach(function(tag) {
  				str += tag.toString();
  			});
  		} else {
  			str += tagElements[tagName].toString();
  		}
  	}
  	return str;
	},

	contentToString: function() {
		var str = '';
		this.content.forEach(function(text) {
			str += text;
		});
		return str;
	},

  toString: function() {
  	var ns = this.nameSpace;
  	var tagName = ns? ns + ':' + this.tagName: this.tagName;
  	var str = this.tagsToString() + this.contentToString();
  	var attrStr = this.attributeToString() + this.nameSpacesToString();
  	if(str) {
  		return '<' + tagName + attrStr + '>' + str + '</' + tagName + '>';
  	}
  	return '<' + tagName + attrStr + '/>';
  }
};
