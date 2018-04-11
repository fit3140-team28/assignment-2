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
var motion_length = 0;
var counter = 0;
var sequence = [];
var light = 'off';
var extra_people = 0;
var light_switch = false;




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



function push_motion(){
	if(motion_length > 8000){
			ref.push({
				type: "long",
				duration: motion_length,
				sequence: null,
				classification: null
			});
		} else if (motion_length < 8000){
			ref.push({
				type:"short",
				duration: motion_length,
				sequence: null,
				classification: null
			});
		}	
	recount();
	var motionRef = admin.database().ref("motions").limitToLast(4);	
	sequence = [];
	counter = 0;	
	motionRef.on("child_added", show_msg)
}

function show_msg(data){
	var msg = data.val();
	sequence.push(msg.type);
	counter ++;
	if (counter == 4){
		find_person(sequence);
	}
}

function find_person(x){
	if (x.length == 4){	
		var thing = is_person(x);
		var person = convert_thing(thing);
		update_person(x, person);
	}
}


function convert_thing(x){
	if (x == true){
		return ('person');
	} else if (x == false){
		return ('other');
	};
}

function is_person(array){
	if (array[0] == 'long' && array[2] == 'long' && array[3] == 'long'){
		if (array[1] == 'short'){
			return true;
		} else {
			return false;		
		}
	} else{
	return false;
	}
}



var db = admin.database();
var ref = db.ref("motions");


function count_long(){
	var count = 0;
	var ref = admin.database().ref("motions");
	ref.orderByChild('type').equalTo('long').on('child_added', function(snapshot){
		count++;
	});
	return count;
}

function count_short(){
	var count = 0;
	var ref = admin.database().ref("motions");
	ref.orderByChild('type').equalTo('short').on('child_added', function(snapshot){
		count++;
	});
	return count;
}

function count_people(){
	var count = 0;
	var pRef = admin.database().ref("motions");
	pRef.orderByChild('classification').equalTo('person').on('child_added', function(snapshot){
		count++;
	});
	return count;
}



function recount(){
	var long = count_long();
	var short = count_short();
	var no_people = count_people();
	var total = [long, short, no_people];
	io.emit('return_count', total);
}

function somebody(){
	io.emit('somebody');
}

board.on("ready", function(){
	var led = new five.Led(13);
	var motion = new five.Motion(7);
	var motion_start;
	var motion_end;	
	motion.on("calibrated", function(){
			console.log("calibrated");
		});
	motion.on("motionstart", function(){
	if (sensor == true){		
		console.log("motionstart");
		var d = new Date();		
		motion_start = d.getTime();
		}
	});
	motion.on("motionend", function(){
	if (sensor == true){
		console.log("motionend");
		var d = new Date();
		motion_end = d.getTime();
		motion_length = motion_end - motion_start;
		console.log("motion length = " + motion_length + "ms/ " + motion_length/1000 + "s \n");
		push_motion();	
	}
	});
	
	io.on("connection", function(client){
		client.on('reset', function(){
			ref.remove();
			ref.off();	
			var long = count_long();
			var short = count_short();
			var no_people = count_people();
			var total = [long, short, no_people];
			io.emit('return_count', total);
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
		client.on('light_switch_on', function(){
			light_switch = true;
			console.log('Light Switch On!');
		});
		client.on('light_switch_off', function(){
			light_switch = false;
			console.log('Light Switch Off!');
		});
		client.on('count', function(){
			var long = count_long();
			var short = count_short();
			var no_people = count_people();
			var total = [long, short, no_people];
			io.emit('return_count', total);
		});
		recount();
		somebody();
		client.on('person_detected', function(){						 
			if (light_switch == true){			
				if (light == 'off'){
					light = 'on';				
					led.on();
					console.log('Person detected - light on for 15 seconds!');
					setTimeout(
						function light_off(){
							led.off();
							light = 'off';
							if (extra_people != 0){
								var i = 0;
								light = 'on';
								led.on();
								console.log('Start of extra time!');
								var interval = setInterval(function(){
									i++;
									if (i == extra_people){
										extra_people = 0;
										led.off();
										light = 'off';
										console.log('Everyone through, lights off!');	
										clearInterval(interval);
									}
									console.log('End of extra time for additional person ' + i);									
								}, 5000);
							}
						}, 15000);
				}	else{
					extra_people += 1;
					console.log('Another person detected! Light on for additional 5 seconds!');
				}
			}
		});
	});
});



function update_person(sequence, thing){
	var motionRef = admin.database().ref("motions").limitToLast(1);
	if (thing == 'person'){
		somebody();
		recount();
	}	
	motionRef.on("child_added", function(data){
		var key = data.key;
		latestRef = admin.database().ref("motions/" + key);
		latestRef.update({
			"sequence": sequence,
			"classification": thing
		})
	});
}



