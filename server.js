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

	dataMap = {
		pageTitle: 'Welcome', 
		message: 'Hello there!',
		authorized: false,
		userList: userDb.users.records,
	}

	res.render('index', dataMap)
})

// Login
app.get('/login', function(req, res) {
	console.log("Welcome, " + req.query.userId)

	var userObj = userDb.users.findById(req.query.userId, function(data, user) {
		req.session.user = user;
		console.log("User Info: " + req.session.user.username);

		if (user) { // Successful login
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
	db.all('SELECT taskId, taskName, question FROM tasks ORDER BY taskId')
		.then(function(taskData) {
			dataMap = {
				tasks: taskData, 
				authorized: req.session.user ? true : false,
				user: req.session.user,
			}

			res.render('taskView', dataMap)
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

	// Get a set of candidate elements
	// db.all('SELECT elementId FROM pairChoices WHERE taskId = ? ORDER BY counter ASC LIMIT 10', requestedTask)
	db.all('SELECT elementId FROM pairChoices WHERE taskId = ? LIMIT 100', requestedTask)
		.then(function(elements) {

			var elementList = elements.map(function(x) {
				return x["elementId"]
			});

			console.log("Found element lists!");
			// console.log(elementList);
			var targetElement = getRandomElement(elementList);
			console.log("Target Element: " + targetElement);

			return db.all('SELECT pairId FROM pairs prs \
				 WHERE \
				 	(prs.leftElement = ? OR prs.rightElement = ?) AND \
				 	( \
					 	SELECT COUNT(*)  \
						FROM comparisons cps  \
						WHERE cps.pairId = prs.pairId \
							AND cps.userId = ? \
				 	) = 0 \
				 LIMIT 10', [targetElement, targetElement, localUser.id]);
		})
		.then(function(pairs) {

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
		})
		.then(function(tweets) {
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
		});
})

// Post pair results to the database
app.post('/pair', function(req, res) {
	console.log("Body: " + req.body);
	console.log("\tpair: " + req.body.pair);
	console.log("\tselected: " + req.body.selected);
	console.log("\tUser ID: " + req.session.user.id);

	var pairId = req.body.pair;
	var userId = req.session.user.id;
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