//initialise external modules for server, websocket, arduino and create instances of them
var express = require("express");
var app = express();
var fs = require("fs");
var path = __dirname;
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var five = require("johnny-five");
var board = new five.Board();
var admin = require("firebase-admin");

//initialise global variables
var sensor = false;
var motion_length = 0;
var counter = 0;
var sequence = [];
var light = 'off';
var extra_people = 0;
var light_switch = false;



//set home page of the server to the local file 'index.html'
app.get('/', function(req, res, next){
	res.sendFile(path + '/index.html');
});

//location of the server
server.listen(5000, function(){
	console.log("Listening on port 5000!");
});


//initialising the webApp and linking it to the correct firebase database
var serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://assignment02-6b825.firebaseio.com"
});


//function to push the detected motion & its type into the database (whether it's a 'person' or not isn't decided yet)
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
	recount(); //update the totals on the webpage as something should have just been added
	//get last 4 entries into the database
	var motionRef = admin.database().ref("motions").limitToLast(4);	
	sequence = [];
	counter = 0;	
	motionRef.on("child_added", show_msg)
}

function show_msg(data){
	var msg = data.val();
	sequence.push(msg.type); //get the motion types of the last 4 entries (including itself)
	counter ++;
	if (counter == 4){
		find_person(sequence);
	}
}

//function that calls 'is_person' (self explanatory) and calls 'convert_thing' which converts the boolean from 'is_person' into a string
function find_person(x){	
	if (x.length == 4){	
		var thing = is_person(x);
		var person = convert_thing(thing);
		update_person(x, person);
	}
}

//function that writes 'person' if they are considered a person and 'other' if not
function convert_thing(x){
	if (x == true){
		return ('person');
	} else if (x == false){
		return ('other');
	};
}

//function that checks if the entry is a 'person' (the last 4 motion types are 'long', 'short', 'long', 'long')
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


//initialise database references
var db = admin.database();
var ref = db.ref("motions");

//counts the number of 'long' motions in the database
function count_long(){
	var count = 0;
	var ref = admin.database().ref("motions");
	ref.orderByChild('type').equalTo('long').on('child_added', function(snapshot){
		count++;
	});
	return count;
}

//counts the number of 'short' motions in the database
function count_short(){
	var count = 0;
	var ref = admin.database().ref("motions");
	ref.orderByChild('type').equalTo('short').on('child_added', function(snapshot){
		count++;
	});
	return count;
}

//counts the number of 'people' in the database
function count_people(){
	var count = 0;
	var pRef = admin.database().ref("motions");
	pRef.orderByChild('classification').equalTo('person').on('child_added', function(snapshot){
		count++;
	});
	return count;
}


//function that calls all the counting functions to update the webpage
function recount(){
	var long = count_long();
	var short = count_short();
	var no_people = count_people();
	var total = [long, short, no_people];
	io.emit('return_count', total);
}

//emit that tells the server that a person has been detected and to turn on the light
function somebody(){
	io.emit('somebody');
}

//initialise and define the arduino board
board.on("ready", function(){
	//initiaise the led and the motion sensor	
	var led = new five.Led(13);
	var motion = new five.Motion(7);
	var motion_start;
	var motion_end;	
	//tells console when the motion sensor is ready (until this is displayed make sure nothing moves in front of it)
	motion.on("calibrated", function(){
			console.log("calibrated");
		});
	//when the sensor detects motion save the timestamp
	motion.on("motionstart", function(){
	if (sensor == true){		
		console.log("motionstart");
		var d = new Date();		
		motion_start = d.getTime();
		}
	});
	//when the sensor detects that the motion has stopped, save the timestamp and get the length of the motion by subtracting the latter from the former
	motion.on("motionend", function(){
	if (sensor == true){
		console.log("motionend");
		var d = new Date();
		motion_end = d.getTime();
		motion_length = motion_end - motion_start;
		console.log("motion length = " + motion_length + "ms/ " + motion_length/1000 + "s \n");
		//put motion into database		
		push_motion();	
	}
	});
	//websocket definitions
	io.on("connection", function(client){
		//when the client pressed the reset button, remove everything and update the webpage
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
		//turning on the sensor
		client.on('sensor_on', function(){
			sensor = true;
			console.log('Sensor On!');
		});
		//turning off the sensor
		client.on('sensor_off', function(){
			sensor = false;
			console.log('Sensor Off!');
		});
		//turning on the light switch
		client.on('light_switch_on', function(){
			light_switch = true;
			console.log('Light Switch On!');
		});
		//turning off the light switch
		client.on('light_switch_off', function(){
			light_switch = false;
			console.log('Light Switch Off!');
		});
		//function that counts motions types and people to update on the webpage
		client.on('count', function(){
			var long = count_long();
			var short = count_short();
			var no_people = count_people();
			var total = [long, short, no_people];
			io.emit('return_count', total);
		});
		//calls count from the server
		recount();
		//calls person_detected from the server
		somebody();
		//when a person is detected, turn on the light for 15s, and if another is detected in that period, keep the light on for another 5s
		client.on('person_detected', function(){						 
			if (light_switch == true){			//if the light is enabled from the webpage (off by default)
				if (light == 'off'){			//if the light is not already on from people recently passing
					light = 'on';				
					led.on();		//turn light on
					console.log('Person detected - light on for 15 seconds!');
					setTimeout(				//after 15s, do this
						function light_off(){
							led.off();			//turn light off unless... (see below)
							light = 'off';
							if (extra_people != 0){		//(from above)... an extra person has entered
								var i = 0;
								light = 'on';
								led.on();
								console.log('Start of extra time!');
								var interval = setInterval(function(){	//every 5 seconds check if sufficent extra light has been given
									i++;
									if (i == extra_people){	//if enough light has been given for the extra people, turn it off
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
				}	else{			//if the light is already on from someone passing recently
					extra_people += 1;		//log the number of extra people for length of extra illumination time
					console.log('Another person detected! Light on for additional 5 seconds!');
				}
			}
		});
	});
});


//function that updates each entry (which right now is just motion type and duration) with their object status and the determining sequence
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



