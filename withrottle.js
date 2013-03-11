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
	self.clients = {};
	
	self.server = net.createServer( function (s) {
		// keep track of new connection in clients object
		s.__clientKey = s.remoteAddress;
		self.clients[s.__clientKey]={'ip': s.remoteAddress};
		self.logClients("CONNECT");

		self.lineHandler = carrier.carry(s);

		// tell WiThrottle/EngineDriver we are version 1.6, as we don't support new whizzy features
		s.write('VN1.6\r\n');

		s.on('end', function() {
			// forget this client
			delete self.clients[s.__clientKey];
			self.logClients("DISCONNECT");
		});

		s.on('error', function (e) {
			self.emit('error',e);
			if (self.callback !== 'undefined')
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

	self.server.listen(self.port, function () {
		self.ad = mdns.createAdvertisement(mdns.tcp('withrottle'), self.port, {name: self.name}).start();
		self.emit('ready');
	});

	self.on('ready', function () {
		console.log("WiThrottle emulator: \"" + self.name + ".local\" listening on port "+ self.port);
	});
}
util.inherits(WiThrottle, EventEmitter);


WiThrottle.prototype.logClients = function(msg) {
	console.log(msg + ": " + util.inspect(this.clients));
}

WiThrottle.prototype.logThrottle = function(msg, s, whichThrottle) {
	console.log(msg + ": " + util.inspect(this.clients[s.__clientKey][whichThrottle]));
}


WiThrottle.prototype.getThrottleProperty = function (s, whichThrottle, prop) {
	if (this.clients[s.__clientKey][whichThrottle] === undefined) {
		return undefined;
	} else {
		return this.clients[s.__clientKey][whichThrottle][prop];
	}
}

WiThrottle.prototype.setThrottleProperty = function (s,whichThrottle, prop, val) {
	if (this.clients[s.__clientKey][whichThrottle] === undefined) {
		this.clients[s.__clientKey][whichThrottle] = {};
	}
	this.clients[s.__clientKey][whichThrottle][prop] = val;
}

WiThrottle.prototype.releaseThrottle = function(s, whichThrottle) {
	delete this.clients[s.__clientKey][whichThrottle];
}


WiThrottle.prototype.doThrottleCommand = function (s, whichThrottle, msg) {
	var self = this,
		cmd = msg.charAt(0),
		arg = msg.slice(1);

	switch (cmd) {
		case 'L':
		case 'S':
			self.setThrottleProperty(s, whichThrottle, 'address', arg);
			self.logThrottle("SET ADDRESS", s, whichThrottle);
			s.write(whichThrottle + arg);
			break;

		case 'R':
			if (msg.charAt(1) == '0') {
				self.setThrottleProperty(s,whichThrottle,'direction','R');
				self.logThrottle("REVERSE", s, whichThrottle);
			} else {
				self.setThrottleProperty(s,whichThrottle,'direction','F');
				self.logThrottle("FORWARD", s, whichThrottle);
			}
			break;

		case 'I':
			self.setThrottleProperty(s,whichThrottle,'speed',0);
			self.logThrottle("IDLE", s, whichThrottle);
			break;

		case 'X':
			self.setThrottleProperty(s,whichThrottle,'speed',1);
			self.logThrottle("ESTOP", s, whichThrottle);
			break;

		case 'V':
			if (self.getThrottleProperty(s,whichThrottle,'direction') === undefined) {
				console.log("inferring forward direction");
				self.setThrottleProperty(s,whichThrottle,'direction','F');
			}
			self.setThrottleProperty(s,whichThrottle,'speed',arg);
			self.logThrottle("SPEED", s, whichThrottle);
			break;

		case 'r':
		case 'd':
			self.logThrottle("RELEASE/DISPATCH", s, whichThrottle);
			self.releaseThrottle(s,whichThrottle);
			s.write(whichThrottle + "Not Set");
			break;

		default:
			console.log("Other Throttle command: " + whichThrottle + msg);
			break;
	}
}


module.exports = {
	WiThrottle: WiThrottle
};
