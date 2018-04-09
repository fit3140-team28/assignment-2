var express = require("express");
var app = express();
var fs = require("fs");
var path = __dirname;
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var five = require("johnny-five");
var board = new five.Board();
var admin = require("firebase-admin");
var sensor = false;



app.get('/', function(req, res, next){
	res.sendFile(path + '/index.html');
});

server.listen(5000, function(){
	console.log("Listening on port 5000!");
});

var serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://assignment02-6b825.firebaseio.com"
});


check_person(function(sequence){
	console.log(sequence);
});

function check_person (callback){
	var motionRef = admin.database().ref("motions").limitToLast(4);
	var sequence = [];	
	motionRef.on("child_added", function(snapshot){
		sequence.push(snapshot.val().type);
		callback(sequence);
	});
	console.log(sequence);
	//motionRef.on("value", function(snapshot){
		//console.log(snapshot.val());
	//});
};

/*function check_person(){
	var sequence = [];
	var motionRef = admin.database().ref().limitToLast(4);
	motionRef.once('value', snap => {
		snap.forEach(item => {sequence.push(item)});
		console.log(sequence);
	});
}*/



var db = admin.database();
var ref = db.ref("motions");


function count_long(){
	var count = 0;
	var ref = admin.database().ref("motions");
	ref.orderByChild('type').equalTo('long').on('child_added', function(snapshot){
		count++;
	});
	console.log('count long = ' + count);
	return count;
}

function count_short(){
	var count = 0;
	var ref = admin.database().ref("motions");
	ref.orderByChild('type').equalTo('short').on('child_added', function(snapshot){
		count++;
	});
	console.log('count short = ' + count);
	return count;
}



io.on("connection", function(client){
	client.on('read', function(){
		ref.remove();	
		console.log('Database Cleared!');
	});
	client.on('sensor_on', function(){
		sensor = true;
		console.log('Sensor On!');
	});
	client.on('sensor_off', function(){
		sensor = false;
		console.log('Sensor Off!');
	});
	client.on('count', function(){
		var long = count_long();
		var short = count_short();
		var total = [long, short]
		client.emit('return_count', total);
	});
});



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
	if (sensor == true){		
		console.log("motionstart");
		led.blink(100);
		var d = new Date();		
		motion_start = d.getTime();
		}
	});
	motion.on("motionend", function(){
	if (sensor == true){
		console.log("motionend");
		led.blink(500);
		var d = new Date();
		motion_end = d.getTime();
		motion_length = motion_end - motion_start;
		console.log("motion length = " + motion_length + "ms/ " + motion_length/1000 + "s \n");
		if(motion_length > 8000){
			ref.push({
				type: "long",
				duration: motion_length
			});
		} else if (motion_length < 8000){
			ref.push({
				type:"short",
				duration: motion_length
			});
		}
	}
	});
});




