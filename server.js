require('babel-polyfill');

var fsp = require('fs-promise')
var express = require('express')
var Promise = require('bluebird')
var db = require('sqlite/legacy')
var userDb = require('./users');
var session = require('express-session')(
	{
		secret: 'pairC0MP!1',
		resave: false,
		saveUninitialized: false,
		cookie: { secure: false }
	});

var dbFile = 'pairComp.sqlite3'

var app = express()

// Construct a parser for JSON
var bodyParser = require('body-parser')
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
})); 

// session?
app.use(session);

// Configure the template engine
app.set('view engine', 'pug')

// Set the static directory
app.use('/static', express.static('public'))

// Function for getting a random element
var getRandomElement = function(arr) {
	var len = arr.length;
	var randIndex = Math.floor(Math.random() * len);

	console.log("Random Index: " + randIndex);

	return arr[randIndex];
}

// Root view
app.get('/', function (req, res) {

	// Call the user records function on the database to get a list of users
	userDb.users.getUsers(db, function(userData) {

		console.log("Successfully retrieved users...");
		// console.log(userData);

		dataMap = {
			pageTitle: 'Welcome', 
			message: 'Hello there!',
			authorized: false,
			userList: userData,
		}

		res.render('index', dataMap)
	})
})

// Login
app.get('/login', function(req, res) {
	console.log("Welcome, " + req.query.userId)

	var userObj = userDb.users.findById(db, req.query.userId, function(data, user) {
		req.session.user = user;
		// console.log("User Info: " + req.session.user);

		if (user) { // Successful login
			console.log("User Info: " + req.session.user.screenname + ", " + req.session.user.userId);
			res.redirect('/taskView');
		} else { // failed login
			res.status(403);
		}
	})
})

// Send a list of the tasks for inspection
app.get('/taskStats', function(req, res) {
	db.all("SELECT t.taskId, t.taskName, t.question, COUNT(c.compareId) AS counter \
		FROM tasks t \
			LEFT OUTER JOIN pairs p ON t.taskId = p.taskId \
			LEFT OUTER JOIN comparisons c ON p.pairId = c.pairId \
		GROUP BY t.taskId \
		ORDER BY t.taskId")
		.then(function(taskData) {
			dataMap = {
				tasks: taskData
			}

			res.render('taskStats', dataMap)
		});
})

// Detailed view for a given task
app.get('/taskStats/:taskId', function(req, res) {
	var taskId = req.params.taskId

	Promise.all([
		db.get("SELECT taskName, question FROM tasks WHERE taskId = ?", taskId),
		db.all("SELECT c.decision, \
				e1.elementId AS lId, e1.elementText AS lText, e1.externalId AS lExt, \
				e2.elementId AS rId, e2.elementText AS rText, e2.externalId AS rExt \
			FROM pairs p \
				JOIN elements AS e1 ON e1.elementId = p.leftElement \
				JOIN elements AS e2 ON e2.elementId = p.rightElement \
				JOIN comparisons c ON p.pairId = c.pairId \
			WHERE p.taskId = ?", taskId)])
		.then(function(taskInfoArray) {

			var taskInfo = taskInfoArray[0];
			var comps = taskInfoArray[1];

			dataMap = {
				taskInfo: taskInfo,
				compList: comps,
			}

			res.render('taskStats-detail', dataMap)
		});
})

// Send a list of the tasks
app.get('/taskView', function(req, res) {
	db.all('SELECT taskId, taskName, question, taskType FROM tasks ORDER BY taskId')
		.then(function(taskData) {
			dataMap = {
				tasks: taskData, 
				authorized: req.session.user ? true : false,
				user: req.session.user,
			}

			res.render('taskView', dataMap)
		});
})


// Send the view for doing labeling
app.get('/labelerView/:id', function (req, res) {

	// Store the task ID in the session
	var requestedTask = req.params.id
	req.session.taskId = requestedTask

	var currentUser = req.session.user
	console.log("Current User Session: " + currentUser.screenname)

	db.get('SELECT taskName, question FROM tasks WHERE taskId = ?', requestedTask)
		.then(function(taskData) {
			taskMap = {
				taskId: requestedTask,
				taskName: taskData.taskName, 
				question: taskData.question,
			}

			return Promise.all([
				taskMap,
				db.all('SELECT labelId, labelText FROM labels WHERE taskId = ?', requestedTask)
			]);
		})
		.then(function(labelData) {

			var taskData = labelData[0];
			var labelList = labelData[1];

			console.log(labelList);
			console.log(labelList.length);

			dataMap = {
				taskId: taskData.taskId,
				taskName: taskData.taskName, 
				question: taskData.question,
				labels: labelList,
				authorized: req.session.user ? true : false,
				user: req.session.user,
			}

			res.render('labelView', dataMap)
		});
})

// Send a tweet for labeling
app.get('/item', function(req, res) {

	// Pull the task from the session
	var requestedTask = req.session.taskId

	console.log("New item requested!");

	var localUser = req.session.user;
	console.log("Local User:");
	console.log(localUser);

	// Get a set of candidate elements
	db.all('SELECT elementId, elementText \
		FROM elements e \
		WHERE taskId = ? AND \
		(SELECT COUNT(*) \
			FROM elementLabels el \
			WHERE el.elementId = e.elementId \
			AND el.userId = ?) == 0 \
	 	LIMIT 10', [requestedTask, localUser.userId])
		.then(function(elements) {

			if ( elements.length > 0 ) {
				var targetElement = getRandomElement(elements);
				console.log("Target Element: " + targetElement);
				console.log("\t" + targetElement["elementId"]);
				console.log("\t" + targetElement["elementText"]);

				res.setHeader('Content-Type', 'application/json');
				res.send(JSON.stringify(targetElement));
			} else {
				console.log("Done!");

				res.setHeader('Content-Type', 'application/json');
				res.send(JSON.stringify({ empty: true }));
			}
		});

})

// Receive a tweet label
app.post('/item', function(req, res) {
	console.log("Body: " + req.body);
	console.log("\telement: " + req.body.element);
	console.log("\tselected: " + req.body.selected);
	console.log("\tUser ID: " + req.session.user.userId);

	var elementId = req.body.element;
	var userId = req.session.user.userId;
	var decision = req.body.selected;

	db.get('INSERT INTO elementLabels (elementId, userId, labelId) \
		VALUES (:elementId, :userId, :decision)', [elementId, userId, decision])
		.then(function() {
			console.log("Decision logged...");
			res.end();
		});
})

// Send the view for doing comparisons
app.get('/pairView/:id', function (req, res) {

	// Store the task ID in the session
	var requestedTask = req.params.id
	req.session.taskId = requestedTask

	var currentUser = req.session.user
	console.log("Current User Session: " + currentUser.username)

	db.get('SELECT taskName, question FROM tasks WHERE taskId = ?', requestedTask)
		.then(function(taskData) {
			dataMap = {
				taskId: requestedTask,
				taskName: taskData.taskName, 
				question: taskData.question,
				authorized: req.session.user ? true : false,
				user: req.session.user,
			}

			res.render('pairView', dataMap)
		});
})

// Send a pair
app.get('/pair', function(req, res) {

	// Pull the task from the session
	var requestedTask = req.session.taskId

	console.log("New pair requested!");

	var localUser = req.session.user;
	console.log("Local User:");
	console.log(localUser);

	// Find a pair we haven't seen before
	db.all('SELECT pairId FROM pairs prs \
				 WHERE \
				 	prs.taskId = ? AND \
				 	( \
					 	SELECT COUNT(*)  \
						FROM comparisons cps  \
						WHERE cps.pairId = prs.pairId \
							AND cps.userId = ? \
				 	) = 0 \
				 LIMIT 100', [requestedTask, localUser.userId])
		.then(function(pairs) {

			if ( pairs.length > 0 ) {
				var pairList = pairs.map(function(x) {
					return x["pairId"]
				});

				console.log("Found candidiate pairs!");
				// console.log(pairList);
				
				var targetPair = getRandomElement(pairList);
				console.log("Target Pair: " + targetPair);
				
				return Promise.all([
					targetPair,
					db.get('SELECT el.elementId, el.elementText FROM \
						elements el JOIN pairs pr ON pr.leftElement = el.elementId \
						WHERE pr.pairId = ?', targetPair),
					db.get('SELECT el.elementId, el.elementText FROM \
						elements el JOIN pairs pr ON pr.rightElement = el.elementId \
						WHERE pr.pairId = ?', targetPair)
				]);
			} else {
				console.log("No pairs. Done!");
				return Promise.resolve({ empty : true });
			}
		})
		.then(function(tweets) {

			if ( !("empty" in tweets) ) {
				var pairId = tweets[0];
				var leftTweet = tweets[1];
				var rightTweet = tweets[2];

				var tweetPair = {
					id: pairId,
					left: {
						tweet: {
							text: leftTweet.elementText,
							id: leftTweet.elementId
						},
						selected: false
					},
					right: {
						tweet: {
							text: rightTweet.elementText,
							id: rightTweet.elementId
						},
						selected: false
					}
				}

				res.setHeader('Content-Type', 'application/json');
				res.send(JSON.stringify(tweetPair));
			} else {
				console.log("Nothing to send.");
				res.setHeader('Content-Type', 'application/json');
				res.send(JSON.stringify({ empty : true }));
			}
		});
})

// Post pair results to the database
app.post('/pair', function(req, res) {
	console.log("Body: " + req.body);
	console.log("\tpair: " + req.body.pair);
	console.log("\tselected: " + req.body.selected);
	console.log("\tUser ID: " + req.session.user.userId);

	var pairId = req.body.pair;
	var userId = req.session.user.userId;
	var decision = req.body.selected;

	db.get('INSERT INTO comparisons (pairId, userId, decision) \
		VALUES (:pairId, :userId, :dec)', [pairId, userId, decision])
		.then(function() {
			console.log("Decision logged...");
			res.end();
		});
})

// Start the server up
Promise.resolve()
	// First, try connect to the database 
	.then(() => db.open(dbFile, { Promise }))
	.catch(err => console.error(err.stack))

	// Now read in the sqlite file to create 

	// Now, with the DB successfully started, start the server
	.finally(() => {
		app.listen(3000, function () {
			console.log('Starting server...')
		})
	})