var EventEmitter = require('events').EventEmitter,
	util = require('util'),
	net = require('net'),
	mdns = require('mdns'),
	carrier = require('carrier');

var	WiThrottle = function(name, port, cmdStation, callback) {
	var self = this;
	EventEmitter.call(self);

	self.name = name;
	self.port = port;
	self.cmdStation = cmdStation;
	self.callback = callback;
	
	console.log("in WiThrottle Constructor");
	
	self.server = net.createServer( function (s) {
		self.lineHandler = carrier.carry(s);

		console.log("client connected");

		// tell WiThrottle/EngineDriver we are version 1.6, as we don't support new whizzy features
		s.write('VN1.6\r\n');

		s.on('end', function() {
			console.log("client disconnected");
		});
		
		s.on('error', function (e) {
			console.log("createServer got an error "+e.message());
			self.callback(e);
		});

		self.lineHandler.on('line', function(msg) {
			var msgString = msg.toString(),
			cmd = msgString.charAt(0),
			arg = msgString.slice(1);

			switch (msgString.charAt(0)) {
				case 'T':
				case 'S':
					self.doThrottleCommand(s,cmd,arg);
					break;
	
				case 'Q':
					s.end();
					break;
	
				default:
					console.log("unhandled message: '"+ msg + "'");
					break;
			}
		});
	});
	
	console.log("hello?");
	
	self.server.listen(self.port, function () {
		console.log("withrottle: " + self.name + " listening on port "+ self.port);
		self.ad = mdns.createAdvertisement(mdns.tcp('withrottle'), self.port, {name: self.name}).start();
	});

}
util.inherits(WiThrottle, EventEmitter);

WiThrottle.prototype.doThrottleCommand = function (s, whichThrottle, msg) {
	var cmd = msg.charAt(0),
		arg = msg.slice(1);

	switch (cmd) {
		case 'L':
		case 'S':
			console.log(whichThrottle + " ADDRESS: " + arg + " ("+cmd+")");
			s.write(whichThrottle + arg);
			break;

		case 'R':
			if (msg.charAt(1) == '0') {
				console.log(whichThrottle + " REVERSE");
			} else {
				console.log(whichThrottle + " FORWARD");
			}
			break;

		case 'I':
			console.log(whichThrottle + " IDLE");
			break;

		case 'X':
			console.log(whichThrottle + " ESTOP");
			break;

		case 'V':
			console.log(whichThrottle + " SPEED: " + arg);
			break;

		case 'r':
		case 'd':
			console.log(whichThrottle + " RELEASE/DISPATCH");
			s.write(whichThrottle+"Not Set");
			break;

		default:
			console.log("Other Throttle command: " + whichThrottle + msg);
			break;
	}
}

module.exports = {
	WiThrottle: WiThrottle
};
