
var EXPORTED_SYMBOLS = ["commonFunctions"];

Components.utils.import("resource:///modules/gloda/log4moz.js");

commonFunctions = {};
commonFunctions.Log = {
	//get the configured logger, loggerName is the name of the logger, level
	// is the logger level
	getConfiguredLogger: function(loggerName, level, consoleLevel, dumpLevel) {
		var logger = Log4Moz.getConfiguredLogger(loggerName, level, consoleLevel, dumpLevel);
		if(logger._hasConfigured)
			return logger;
		logger._hasConfigured = true;

		//when log, add the filename and the line number in the last
		var oldLog = logger.log;
		function newLog(level, args) {
			oldLog.call(logger,level, addFileLine(Array.prototype.slice.call(args)));
		};
		logger.log = newLog;
		return logger;

		function addFileLine(args) {
			let jsFrame = Components.stack.caller.caller.caller;
			try {
				var str = "\n(in file " + jsFrame.filename + ",function name "
					+ jsFrame.name + ",line " + jsFrame.lineNumber + ")";
			} catch(e) {}
			args.push(str);
			return args;
		}
	},
	getBaseLog: function() {
		var infoLevel = Log4Moz.Level.Info;
		return this.getConfiguredLogger('exchange.base', infoLevel, infoLevel,
			infoLevel);
	}
};

commonFunctions.baseLog = commonFunctions.Log.getBaseLog();
