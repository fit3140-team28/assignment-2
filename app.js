var five = require("johnny-five");
var board = new five.Board();


board.on("ready", function(){
	var led = new five.Led(13);
	led.blink(500);
	var motion = new five.Motion(7);
	var motion_start;
	var motion_end;	
	var motion_length;
	motion.on("calibrated", function(){
		console.log("calibrated");
	});
	motion.on("motionstart", function(){
		console.log("motionstart");
		led.blink(100);
		var d = new Date();		
		motion_start = d.getTime();
	});
	motion.on("motionend", function(){
		console.log("motionend");
		led.blink(500);
		var d = new Date();
		motion_end = d.getTime();
		motion_length = motion_end - motion_start;
		console.log("motion length = " + motion_length + "ms/ " + motion_length/1000 + "s");
	});
});




