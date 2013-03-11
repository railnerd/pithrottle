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
		console.log("connect: "+util.inspect(self.clients));

		self.lineHandler = carrier.carry(s);

		// tell WiThrottle/EngineDriver we are version 1.6, as we don't support new whizzy features
		s.write('VN1.6\r\n');

		s.on('end', function() {
			// forget this client
			delete self.clients[s.__clientKey];
			console.log("DISCONNECT: "+util.inspect(self.clients));
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


WiThrottle.prototype.getThrottleProperty = function (s,whichThrottle,key) {
	if (this.clients[s.__clientKey][whichThrottle] === undefined) {
		return undefined;
	} else {
		return this.clients[s.__clientKey][whichThrottle][key];
	}
}


WiThrottle.prototype.setThrottleProperty = function (s,whichThrottle,prop,val) {
	if (this.clients[s.__clientKey][whichThrottle] === undefined) {
		this.clients[s.__clientKey][whichThrottle] = {};
	}
	this.clients[s.__clientKey][whichThrottle][prop] = val;
}

WiThrottle.prototype.doThrottleCommand = function (s, whichThrottle, msg) {
	var self = this,
		cmd = msg.charAt(0),
		arg = msg.slice(1);

	switch (cmd) {
		case 'L':
		case 'S':
			self.setThrottleProperty(s,whichThrottle,'address',arg);
			console.log("SET ADDRESS: " + util.inspect(self.clients));
			s.write(whichThrottle + arg);
			break;

		case 'R':
			if (msg.charAt(1) == '0') {
				self.setThrottleProperty(s,whichThrottle,'direction','R');
				console.log("REVERSE: " + util.inspect(self.clients[s.__clientKey]));
			} else {
				self.setThrottleProperty(s,whichThrottle,'direction','F');
				console.log("FORWARD: " + util.inspect(self.clients[s.__clientKey]));
			}
			break;

		case 'I':
			self.setThrottleProperty(s,whichThrottle,'speed',0);
			console.log("IDLE: " + util.inspect(self.clients[s.__clientKey]));
			break;

		case 'X':
			self.setThrottleProperty(s,whichThrottle,'speed',1);
			console.log("ESTOP: " + util.inspect(self.clients[s.__clientKey]));
			break;

		case 'V':
			if (self.getThrottleProperty(s,whichThrottle,'direction') === undefined) {
				console.log("inferring forward direction");
				self.setThrottleProperty(s,whichThrottle,'direction','F');
			}
			self.setThrottleProperty(s,whichThrottle,'speed',arg);
			console.log("SPEED: " + util.inspect(self.clients[s.__clientKey]));
			break;

		case 'r':
		case 'd':
			console.log(whichThrottle + " RELEASE/DISPATCH");
			delete self.clients[s.__clientKey][whichThrottle];
			console.log("RELEASE: " + util.inspect(self.clients));
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
