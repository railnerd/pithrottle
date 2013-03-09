#! /usr/bin/env node

var NCE = require('./nce').NCE,
	WiThrottle = require('./withrottle').WiThrottle,
	hexy = require('hexy');

// options; replace with commander or optimist
var program = {port:8192, name:"notJMRI", device:"/dev/cu.SLAB_USBtoUART"};

var cmdStation = new NCE(program.device, function (err) {
	if (err !== undefined) {
		console.error("Failed to initialize: " + err);
		process.exit(1);
	}
});

// debugging hooks to examine command station traffic

function hexDump(buf) {
	var dumpString = hexy.hexy(buf,{numbering:"none", format:"twos", annotate: "none"});
	return dumpString.substring(0,dumpString.length-2);
}

cmdStation.on('RECV', function (data) {
    console.log("RECV : " + hexDump(data));
});

cmdStation.on('response', function (data) {
    console.log("RESPONSE : " + hexDump(data));
});

cmdStation.on('SEND', function (data) {
    console.log("SEND : " + hexDump(data));
});


cmdStation.on('ready', function () {

	// check command station version
	cmdStation.getVersion(function(vers) {
		console.log("Command Station Version: "+ hexDump(vers));
	});

	var WiThrottle = new WiThrottle(program.name, program.port, cmdStation, function (err) {
		if (err !== undefined) {
			console.log("Failed to initialize WiThrottle server: " + err);
			process.exit(1);
		}
	});
});
