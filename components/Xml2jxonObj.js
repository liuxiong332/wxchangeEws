
Components.utils.import('resource://exchangeEws/commonFunctions.js');
var log = commonFunctions.Log.getErrorLevelLogger('xml2jxon');

var EXPORTED_SYMBOLS = ['Xml2jxonObj', 'XmlProcessor', 'RegStrExecutor',
	'XPathProcessor'];

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
		xmlObj.namespace = res[1];
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

		if(!res || (res[1] !== xmlObj.namespace) || (res[2] !== xmlObj.tagName))
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

/*the XPathProcessor is process the XPath selector, but not all of
 * XPath is supported, it can support below XPath selector:
 *  /node, //node, node, @attr, //@attr, /@attr, . , [val1 >= val2 and|or ...]
 */
function XPathProcessor(xmlObj) {
	this.rootObj = new Xml2jxonObj;
	this.rootObj.addChildTagObject(xmlObj);
}

XPathProcessor.prototype = {
	processXPath: function(xPath) {
		return this.processExpr([this.rootObj], xPath);
	},

	processExpr: function(results, exprStr) {
		// log.info(JSON.stringify(results, null, 4));
		var tempRes = results;
		var exprReg = /(.+?)(?=\/|\[)/gy, exprRes;
		var exprExecutor = new RegStrExecutor(exprStr);
		while((exprRes = exprExecutor.execute(exprReg))) {
			tempRes = this.processOneExpr(tempRes, exprRes[1]);
		}
		exprRes = exprExecutor.execute(/(.+)$/gy);
		if(exprRes) {
			log.info('the exprRes in processExpr is:' + exprRes[1]);
			tempRes = this.processOneExpr(tempRes, exprRes[1]);
		}
		return tempRes;
	},

	processOneExpr: function(results, exprStr) {
		log.info('the exprStr in processOneExpr is:' + exprStr + '.');
		if(exprStr === '.')
			return results;
		var filterReg = /\s*\[(.+?)\]\s*/;
		var filterRes = filterReg.exec(exprStr);
		if(filterRes) {
			return this.processFilterExpr(results, filterRes[1]);
		}
		var pathReg = /\s*(\/\/?)(.+?)\s*$/;
		var pathRes = pathReg.exec(exprStr);
		if(pathRes) {
			switch(pathRes[1]) {
				case '/': 	return this.processChildExpr(results, pathRes[2]);
				case '//':
					return this.processRecursiveDescentExpr(results, pathRes[2]);
			}
		}
		// log.info('processOneExpr the node or @attr');
		return this.processChildExpr(results, exprStr);
	},

	processChildExpr: function(results, nodeStr) {
		var tempResult = [];
		if(nodeStr === '*') {		// /*
			results.forEach(function(node) {
				tempResult = tempResult.concat(node.getAllChildTags());
			});
		} else {
			var attrRes = /@([\w:]+)/.exec(nodeStr);
			if(!attrRes) {				// /nodeName
				log.info('the nodeStr is:' + nodeStr + '.');
				results.forEach(function(node) {
					tempResult = tempResult.concat(node.getChildTags(nodeStr));
				});
			} else {							// /@AttrName
				var attrName = attrRes[1];
				// log.info('the attr name is:' + attrName + '.');
				results.forEach(function(node) {
					node.hasAttribute(attrName) &&
						tempResult.push(node.getAttribute(attrName));
				});
			}
		}
		return tempResult;
	},

	processRecursiveDescentExpr: function(results, nodeStr) {
		var tempResult = this.processChildExpr(results, nodeStr);
		results.forEach(function(node) {
			tempResult = tempResult.concat(
				this.processRecursiveDescentExpr(node.getAllChildTags(), nodeStr));
		}, this);
		return tempResult;
	},

	processFilterExpr: function(results, filterStr) {
		log.info('the filterStr in processFilterExpr is:' + filterStr + '.');
		var self = this;
		return results.filter(function(node) {
			return self.processOneFilterExpr([node], filterStr);
		});
	},

	processOneFilterExpr: function(node, filterStr) {
		log.info('the filterStr is:' + filterStr + '.');
		var AND_OPERATOR = 1, OR_OPERATOR = 2;
		var logicOperator = AND_OPERATOR;
		var leftOperand = true;

		var self = this;
		var filterExecutor = new RegStrExecutor(filterStr);
		var filterRes = null;
		var filterReg = /\s*(.+?)\s+(?=(and)|(or))/g;
		var logicReg = /((and)|(or))\s+/g;
		while((filterRes = filterExecutor.execute(filterReg))) {
			log.info('the filterRes is:' + filterRes[0] + '.');
			leftOperand = getLogicResult(node, filterRes[1]);
			logicRes = filterExecutor.execute(logicReg)[1];
			switch(logicRes) {
				case 'and': {
					if(!leftOperand) 	return false; 		//short path calculate
					logicOperator = AND_OPERATOR;
					break;
				}
				case 'or': {
					if(leftOperand) 	return true;
					logicOperator = OR_OPERATOR;
					break;
				}
			}
		}
		var rightOperand = filterExecutor.execute(/\s*(.+?)\s*$/g)[1];
		return getLogicResult(node, rightOperand);

		function getLogicResult(node, rightStr) {
			var res;
			var rightOperand = self.processCompareExpr(node, rightStr);
			switch(logicOperator) {
				case AND_OPERATOR: 	res = leftOperand && rightOperand; break;
				case OR_OPERATOR:   res = leftOperand || rightOperand; break;
			}
			return res;
		}
	},

	processCompareExpr: function(results, exprStr) {
		log.info('the exprStr is:' + exprStr + '.');
		var exprReg = /\s*(.+?)\s*(=|>|<|(?:>=)|(?:<=)|(?:!=))\s*(.+?)\s*$/;
		var regRes = exprReg.exec(exprStr);
		if(!regRes)
			return this.getValueFromExpr(results, exprStr) !== null;

		var left = this.getValueFromExpr(results, regRes[1]);
		var right = this.getValueFromExpr(results, regRes[3]);
		// log.info('the left is:' + left + ', the right is:' + right + '.');
		switch(regRes[2]) {
			case '=': 	return left == right;
			case '>': 	return left > right;
			case '<': 	return left < right;
			case '>=': 	return left >= right;
			case '<=':  return left <= right;
			case '!=':  return left != right;
		}
		return false;
	},

	getValueFromExpr: function(results, exprStr) {
		log.info('the value expr str is :' + exprStr + '.');
		var strReg = /^\s*('|")(.+?)\1\s*$/;
		var strRegRes = strReg.exec(exprStr);
		if(strRegRes) {
			return strRegRes[2];
		}
		var numberReg = /^\s*[+-]?\d*(\.?)\d*$/;
		var numberRegRes = numberReg.exec(exprStr);
		if(numberRegRes) {
			if(numberRegRes[1])		return parseFloat(exprStr);
			return parseInt(exprStr, 10);
		}
		log.info('begin process expr');
		var operand = this.processExpr(results, exprStr);
		if(operand.length === 0)	return null;
		operand = operand[0];
		log.info('the value is :' + operand + '.');
		operand.getValue && (operand = operand.getValue());	//tag element
		return operand;
	}
}

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

function Xml2jxonObj(tagName, namespace) {
  this.namespaces = {};
  this.tags = {};
  this.attr = {};
  this.content = [];
  tagName && this.setTagName(tagName, namespace);
}

Xml2jxonObj.constructor = function() {
	return new Xml2jxonObj;
};

Xml2jxonObj.createFromXML = function(xmlStr) {
  var processor = new XmlProcessor(xmlStr);
  return processor.processXmlObj(Xml2jxonObj.constructor);
};

Xml2jxonObj.prototype = {
	/*add the text into the value content*/
	addToContent: function(text) {
    this.content.push(convertSpecialCharatersFromXML(text));
  },

  explodeAttribute: function(attrNs, attrName, attrValue) {
    if (attrNs === "xmlns") {
      this.addNamespace(attrName, attrValue);
    } else if(!attrNs && attrName === 'xmlns') {
      this.addNamespace("_default_" , attrValue);
    } else {
    	var attrTag = attrNs? attrNs + ':' + attrName : attrName;
      this.attr[attrTag] = convertSpecialCharatersFromXML(attrValue);
    }
  },

  setTagName: function(tagName, namespace) {
    if(!tagName)  return ;
    if(namespace) {
      this.tagName = tagName;
      this.namespace = namespace;
    } else {
      var tagHeadReg = /^(?:(\w+):)?(\w+)$/;
      var res = tagHeadReg.exec(tagName);
      if(!res)  throw new Error('the tagName format is invalid');
      this.namespace = res[1];
      this.tagName = res[2];
    }
  },

  getNamespace: function(nsAlias) {
    !nsAlias && (nsAlias = '_default_');
    return this.namespaces[nsAlias];
  },
  addNamespace: function(nsAlias, nsUri) {
    this.namespaces[nsAlias] = nsUri;
  },

  addChildTagObject: function(childTagObj) {
  	var tagNs = childTagObj.namespace;
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
    newObj.namespace = ns;
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

  hasAttribute: function(attrTag) {
  	return !!this.attr[attrTag];
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

  getAllChildTags: function() {
  	var childTags = [];
  	for(var tagIndex in this.tags) {
  		var tagElements = this.tags[tagIndex];
  		if(Array.isArray(tagElements))
  			childTags = childTags.concat(tagElements);
  		else
  			childTags.push(tagElements);
  	}
  	return childTags;
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

  namespacesToString: function() {
  	var str = '';
  	for(var ns in this.namespaces) {
  		if(ns === '_default_')
  			str += ' xmlns="' + this.namespaces[ns] + '"';
  		else
  			str += ' xmlns:' + ns + '="' + this.namespaces[ns] + '"';
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
  	var ns = this.namespace;
  	var tagName = ns? ns + ':' + this.tagName: this.tagName;
  	var str = this.tagsToString() + this.contentToString();
  	var attrStr = this.attributeToString() + this.namespacesToString();
  	if(str) {
  		return '<' + tagName + attrStr + '>' + str + '</' + tagName + '>';
  	}
  	return '<' + tagName + attrStr + '/>';
  },

  XPath: function(xPath) {
    var xPathProcessor = new XPathProcessor(this);
    return xPathProcessor.processXPath(xPath);
  }
};
