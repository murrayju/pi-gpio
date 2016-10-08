"use strict";
var fs = require("fs"),
	path = require("path"),
	exec = require("child_process").exec,
	q = require("q");

var gpioAdmin = "gpio-admin",
	sysFsPath = "/sys/class/gpio";

var pinMapping = {
	"3": 0,
	"5": 1,
	"7": 4,
	"8": 14,
	"10": 15,
	"11": 17,
	"12": 18,
	"13": 21,
	"15": 22,
	"16": 23,
	"18": 24,
	"19": 10,
	"21": 9,
	"22": 25,
	"23": 11,
	"24": 8,
	"26": 7
};

var pinMapping2V512 = {
	"3"  : 2,
	"5"  : 3,
	"13" : 27
};

var revision = fs.readFileSync('/proc/cpuinfo', 'utf-8').match(/Revision\t\:\s([\d\w]+)/);
if(revision && parseInt(revision[1], 16) > 3){
	for(var pin in pinMapping2V512){
		pinMapping[pin] = pinMapping2V512[pin];
	}
}

function isNumber(number) {
	return !isNaN(parseInt(number, 10));
}

function qExec (command, options) {
	var defer = q.defer();

	exec(command, options, function (error, stdout, stderr) {
		if (error) {
			defer.reject({
				error: error,
				stdout: stdout,
				stderr: stderr
			});
		} else {
			defer.resolve(stdout);
		}
	});

	return defer.promise;
}

function printExecError(method, pinNumber, err) {
	console.error("Error when trying to", method, "pin", pinNumber);
	console.error(err.stderr);
}

function sanitizePinNumber(pinNumber) {
	if(!isNumber(pinNumber) || !isNumber(pinMapping[pinNumber])) {
		throw new Error("Pin number isn't valid");
	}

	return parseInt(pinNumber, 10);
}

function sanitizeDirection(direction) {
	direction = (direction || "").toLowerCase().trim();
	if(direction === "in" || direction === "input") {
		return "in";
	} else if(direction === "out" || direction === "output" || !direction) {
		return "out";
	} else {
		throw new Error("Direction must be 'input' or 'output'");
	}
}

var gpio = {
	open: function(pinNumber, direction) {
		pinNumber = sanitizePinNumber(pinNumber);
		direction = sanitizeDirection(direction || "out");

		return qExec(gpioAdmin + " export " + pinMapping[pinNumber])
			.then(function (stdout) {
				return gpio.setDirection(pinNumber, direction);
			}, function (err) {
				printExecError("open", pinNumber, err);
				throw err.error;
			});
	},

	setDirection: function(pinNumber, direction) {
		pinNumber = sanitizePinNumber(pinNumber);
		direction = sanitizeDirection(direction);

		return q.nfcall(fs.writeFile, sysFsPath + "/gpio" + pinMapping[pinNumber] + "/direction", direction);
	},

	getDirection: function(pinNumber) {
		pinNumber = sanitizePinNumber(pinNumber);

		return q.nfcall(fs.readFile, sysFsPath + "/gpio" + pinMapping[pinNumber] + "/direction", "utf8")
			.then(function (direction) {
				return sanitizeDirection(direction.trim());
			});
	},

	close: function(pinNumber) {
		pinNumber = sanitizePinNumber(pinNumber);

		return qExec(gpioAdmin + " unexport " + pinMapping[pinNumber])
			.then(null, function (err) {
				printExecError("close", pinNumber, err);
				throw err.error;
			});
	},

	read: function(pinNumber) {
		pinNumber = sanitizePinNumber(pinNumber);

		return q.nfcall(fs.readFile, sysFsPath + "/gpio" + pinMapping[pinNumber] + "/value")
			.then(function (data) {
				return parseInt(data, 10);
			});
	},

	write: function(pinNumber, value) {
		pinNumber = sanitizePinNumber(pinNumber);

		value = !!value?"1":"0";

		return q.nfcall(fs.writeFile, sysFsPath + "/gpio" + pinMapping[pinNumber] + "/value", value, "utf8");
	}
};

gpio.export = gpio.open;
gpio.unexport = gpio.close;

module.exports = gpio;
