require('babel-polyfill');

var fsp = require('fs-promise');
var express = require('express');
var Promise = require('bluebird');
var db = require('sqlite/legacy');
var userDb = require('./users');
var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;
var crypto = require('crypto');
var cookieParser = require('cookie-parser');
var flash = require('connect-flash');
var fs = require('fs');

var config_str = fs.readFileSync('CONFIG.json');
var config = JSON.parse(config_str);

var session = require('express-session')(
    {
        secret: 'pairC0MP!1',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }
    });

var dbFile = config.db_path;

var app = express();
//var flash = require('connect-flash');
app.use(flash());

function hashPassword(password, salt) {
    var has = crypto.createHash('sha256');
    hash.update(password);
    hash.update(salt);
    return hash.digest('hex');
}

//WILL BE USED ONCE HASHED PASSWORD STORAGE IS IMPLEMENTED
passport.use(new LocalStrategy(function (username, password, done) {
    db.get('SELECT salt FROM users WHERE username = ?', username, function (err, row) {
        if (!row) return done(null, false);
        var hash = hashPassword(password, row.salt);
        db.get('SELECT username, id FROM users WHERE username = ? AND password = ?', username, hash, function (err, row) {
            if (!row) return done(null, false);
            return done(null, row);
        });
    });
}));


passport.serializeUser(function (user, done) {
    return done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    db.get('SELECT id, username FROM users WHERE id = ?', id, function (err, row) {
        if (!row) return done(null, false);
        return done(null, row);
    });
});

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

app.use(passport.initialize());
//app.use(app.router);

// Function for getting a random element
var getRandomElement = function (arr) {
    var len = arr.length;
    var randIndex = Math.floor(Math.random() * len);

    console.log("Random Index: " + randIndex);

    return arr[randIndex];
}

// Root view
app.get('/', function (req, res) {

    if (!("user" in req.session) || req.session.user === null) {

        req.session.user = null;

        // Call the user records function on the database to get a list of users
        userDb.users.getUsers(db, function (userData) {

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

    } else {

        console.log("User is already logged in...");
        res.redirect('/taskView')

    }


})

// Login
/*app.get('/login', function(req, res) {
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
	});

    
});*/

app.get('/login', function (req, res) {
    console.log('login attempt');
    console.log(req.query.username);
    console.log(req.query.password);
    var userObj = userDb.users.findByScreenname(db, req.query.username, function (data, user) {

        if (user) {
            console.log("found user");
            if (user.password == req.query.password) {
                //req.session.user = user;
                req.session.user = user;
                console.log("User Info: " + req.session.user.screenname + ", " + req.session.user.userId);
                res.redirect('/taskView');
            }
            else {
                req.session.user = null;
                //req.flash('Please enter a valid username-password combination');
                res.redirect('/');
            }
        } else {
            //req.flash('Please enter a valid username');
            res.redirect('/');
            res.status(403);
        }
    });
});

//FOR HASHED PASSWORDS
/*
app.post('/login', passport.authenticate('local', {
    successRedirect: '/taskView',
    failureRedirect: '/login',
    failureFlash: false
}));*/

// Send a list of the tasks for inspection
app.get('/taskStats', function (req, res) {

    if (!("user" in req.session) || req.session.user === null) {

        console.log("User is not logged in...");
        res.redirect('/')

        return;
    }

    db.all("SELECT t.taskId, t.taskName, t.question, COUNT(c.compareId) AS counter \
		FROM tasks t \
			LEFT OUTER JOIN pairs p ON t.taskId = p.taskId \
			LEFT OUTER JOIN comparisons c ON p.pairId = c.pairId \
		WHERE t.taskType == 1 \
		GROUP BY t.taskId \
		ORDER BY t.taskId")
        .then(function (pairTaskData) {
            var labelTaskData = '';

            if (!req.session.user.isadmin) {
                labelTaskData = db.all("SELECT t.taskId, t.taskName, t.question, COUNT(DISTINCT(e.elementId)) AS eCount, COUNT(el.elementLabelId) AS labelCount \
            FROM tasks t \
            	LEFT OUTER JOIN elements e ON t.taskId = e.taskId \
            	LEFT OUTER JOIN elementLabels el ON e.elementId = el.elementId \
              JOIN assignedTasks at ON t.taskId = at.assignedTaskId \
            WHERE t.taskType == 2 \
                    AND at.userId == ? \
            GROUP BY t.taskId \
            ORDER BY t.taskId",
                    req.session.user.userId);
            }
            else {
                labelTaskData = db.all("SELECT t.taskId, t.taskName, t.question, COUNT(DISTINCT(e.elementId)) AS eCount, COUNT(el.elementLabelId) AS labelCount \
            FROM tasks t \
            	LEFT OUTER JOIN elements e ON t.taskId = e.taskId \
            	LEFT OUTER JOIN elementLabels el ON e.elementId = el.elementId \
            WHERE t.taskType == 2 \
            GROUP BY t.taskId \
            ORDER BY t.taskId");
            }

            return Promise.all([
                pairTaskData,
                labelTaskData
            ]);
        })
        .then(function (taskData) {

            var pairTaskData = taskData[0];
            var labelTaskData = taskData[1];
            var rangeData = '';

            if (!req.session.user.isadmin) {
                rangeData = db.all("SELECT t.taskId, t.taskName, t.question, COUNT(DISTINCT(e.elementId)) AS eCount, COUNT(DISTINCT(rd.elementId)) AS rdCount \
            FROM tasks t \
              LEFT OUTER JOIN elements e ON t.taskId = e.taskId \
              LEFT OUTER JOIN rangeQuestions rq ON t.taskId  = rq.taskId \
              LEFT OUTER JOIN rangeDecisions rd ON rq.rangeQuestionId = rd.rangeQuestionId \
              LEFT OUTER JOIN assignedTasks at ON t.taskId = at.assignedTaskId \
              LEFT OUTER JOIN users u ON rd.userId = u.userId \
            WHERE t.taskType == 3 \
                    AND at.userId == ? \
            GROUP BY t.taskId \
            ORDER BY t.taskId",
                    req.session.user.userId);
            }
            else {
                rangeData = db.all("SELECT t.taskId, t.taskName, t.question, COUNT(DISTINCT(e.elementId)) AS eCount, COUNT(DISTINCT(rd.elementId)) AS rdCount \
            FROM tasks t \
              LEFT OUTER JOIN elements e ON t.taskId = e.taskId \
              LEFT OUTER JOIN rangeQuestions rq ON e.taskId = rq.taskId \
              LEFT OUTER JOIN rangeDecisions rd ON rq.rangeQuestionId = rd.rangeQuestionId \
              LEFT OUTER JOIN users u on rd.userId = u.userId \
            WHERE t.taskType == 3 \
            GROUP BY t.taskId \
            ORDER BY t.taskId");
            }

            return Promise.all([
                pairTaskData,
                labelTaskData,
                rangeData
            ]);

        }).then(function (taskData) {
            dataMap = {
                pairTasks: taskData[0],
                labelTasks: taskData[1],
                rangeTasks: taskData[2],
            }
            res.render('taskStats', dataMap)
        });
})

var calculateAgreement = function (taskInfo, taskDetails, userDetails) {
    // Agreement statistics
    var agreementStats = {
        user1: null,
        user2: null,
        overlapCount: 0,
        agreeCount: 0,
        agreement: null,
    }

    // For now, stats for labeling makes sense
    if (taskInfo.taskType == 2) {

        var userCounts = userDetails.map(function (currentValue, index, array) {
            return {
                uId: currentValue.uId,
                count: currentValue.count,
                fname: currentValue.fname,
                lname: currentValue.lname
            }
        }).sort(function (l, r) {
            // want to compare the second array element, and we want
            //  to sort in decreasing order
            return r.count - l.count;
        });

        // If we have more than 1 user, get the first two
        if (userCounts.length > 1) {
            var user1 = userCounts[0];
            var user2 = userCounts[1];

            var leftLabels = taskDetails.filter(function (currentValue, index, array) {
                return currentValue.uId == user1.uId;
            });
            var rightLabels = taskDetails.filter(function (currentValue, index, array) {
                return currentValue.uId == user2.uId;
            });

            // Create a map of labels
            var labelMap = {};
            taskDetails.forEach(function (element) {
                if (!(element.lId in labelMap)) {
                    labelMap[element.lId] = 1;
                } else {
                    labelMap[element.lId] = labelMap[element.lId] + 1;
                }
            });
            var uniqueLabels = Object.keys(labelMap);

            // Create a map of elements
            var elementMap = {};
            leftLabels.forEach(function (cv) {
                elementMap[cv.eId] = { left: cv, right: null };
            });
            rightLabels.forEach(function (cv) {
                if (!(cv.eId in elementMap)) {
                    elementMap[cv.eId] = { left: null, right: cv };
                } else {
                    elementMap[cv.eId].right = cv;
                }
            });

            // Shared ids
            var labelOverlap = [];
            for (elementId in elementMap) {
                var cv = elementMap[elementId];
                if (cv.left != null && cv.right != null) {
                    labelOverlap.push(elementId);
                }
            }

            var sharedLabelCount = labelOverlap.length;
            var agreedLabels = labelOverlap.filter(function (elementId) {
                var cv = elementMap[elementId];
                return cv.left.lId == cv.right.lId;
            });
            var agreedLabelCount = agreedLabels.length;

            // Calculate agreement
            var nkSum = 0;
            uniqueLabels.forEach(function (label) {
                // Calculate nk1 * nk2
                nk1 = labelOverlap.filter(function (elementId) {
                    var cv = elementMap[elementId];
                    return cv.right.lId == label;
                }).length;
                nk2 = labelOverlap.filter(function (elementId) {
                    var cv = elementMap[elementId];
                    return cv.left.lId == label;
                }).length;

                nkSum = nkSum + (nk1 * nk2);
            });
            var pSubE = nkSum / (sharedLabelCount * sharedLabelCount);
            var pSubO = agreedLabelCount / sharedLabelCount;
            var kappa = 1 - (1 - pSubO) / (1 - pSubE);

            // Update user stats
            agreementStats.user1 = user1;
            agreementStats.user2 = user2;
            agreementStats.agreeCount = agreedLabelCount;
            agreementStats.overlapCount = sharedLabelCount;
            agreementStats.agreement = kappa;
        }
    }

    return agreementStats;
}

// Detailed view for a given task
app.get('/taskStats/:taskId', function (req, res) {

    if (!("user" in req.session) || req.session.user === null) {

        console.log("User is not logged in...");
        res.redirect('/')

        return;
    }

    var taskId = req.params.taskId

    db.get("SELECT taskName, question, taskType FROM tasks WHERE taskId = ?", taskId)
        .then(function (taskData) {

            var taskDetails = {
                taskInfo: taskData
            };

            if (taskData.taskType == 1) {
				var userId = "%"
				
				if(!req.session.user['isadmin']){
					userId = req.session.user.userId;
				}
				
                var compDetails = db.all("SELECT c.decision, \
						e1.elementId AS lId, e1.elementText AS lText, e1.externalId AS lExt, \
						e2.elementId AS rId, e2.elementText AS rText, e2.externalId AS rExt \
					FROM pairs p \
						JOIN elements AS e1 ON e1.elementId = p.leftElement \
						JOIN elements AS e2 ON e2.elementId = p.rightElement \
						JOIN comparisons c ON p.pairId = c.pairId \
					WHERE p.taskId = ?", taskId);

                taskDetails["labels"] = compDetails;

                // Get the users who have labeled this task
                var userLabelDetails = db.all("SELECT u.fname AS fname, u.lname AS lname, COUNT(*) as count \
              FROM users u \
                  JOIN comparisons c ON u.userId=c.userId \
                  JOIN pairs p ON p.pairId=c.pairId \
              WHERE p.taskId = ? \
			  AND u.userId = ? \
              GROUP BY u.userId", taskId, userId);

                taskDetails["userDetails"] = userLabelDetails;

                // Pairwise comparisons don't have label options, so null this
                taskDetails["labelOptions"] = null;

            } else if (taskData.taskType == 2) {
				var userId = "%"
				
				if(!req.session.user['isadmin']){
					userId = req.session.user.userId;
				}


                var labelOptions = db.all("SELECT l.labelId AS lId, l.labelText AS lText, l.parentLabel AS lParent \
            FROM labels l \
            WHERE l.taskId = ? \
            ORDER BY l.taskId", taskId);

                taskDetails["labelOptions"] = labelOptions;

                var labelDetails = db.all("SELECT e.elementId AS eId, e.elementText AS eText, el.elementLabelId AS elId, u.userId AS uId, u.screenname AS screenname, l.labelId AS lId, l.labelText AS lText \
            FROM elements e \
                JOIN elementLabels el ON e.elementId = el.elementId \
                JOIN labels l ON el.labelId = l.labelId \
                JOIN users u ON u.userId = el.userId \
            WHERE e.taskId = ? \
			AND u.userId = ? \
            ORDER BY e.elementId", taskId, userId);

                taskDetails["labels"] = labelDetails;

                // Get the users who have labeled this task
                var userLabelDetails = db.all("SELECT u.userId AS uId, u.fname AS fname, u.lname AS lname, COUNT(*) AS count \
              FROM users u \
                  JOIN elementLabels el ON u.userId = el.userId \
                  JOIN elements e ON el.elementId = e.elementId \
              WHERE e.taskId = ? \
			  AND u.userId = ? \
              GROUP BY u.userId", taskId, userId);

                taskDetails["userDetails"] = userLabelDetails;

            } else if (taskData.taskType == 3) {
				var userId = "%"
				
				if(!req.session.user['isadmin']){
					userId = req.session.user.userId;
				}
				

                // Get the options users have for this task
                var rangeQuestions = db.all(
                    "SELECT \
                        rq.rangeQuestionId AS rqId, \
                        rq.rangeQuestion AS rqQ, \
                        rs.rangeScaleId AS rsId, \
                        rs.rangeValue AS rsValue, \
                        rs.rangeOrder as rsOrder \
                    FROM rangeQuestions rq \
                        JOIN rangeScales rs ON rs.rangeQuestionId = rq.rangeQuestionId  \
                    WHERE rq.taskId = ?", taskId);    

                taskDetails["labelOptions"] = rangeQuestions;

                // Get the answers users have provided for this task
                var rangeAnswers = db.all(
                    "SELECT \
                        rd.rangeDecisionId AS rdId, \
                        rd.rangeScaleId AS rsId, \
                        rs.rangeQuestionId AS rqId, \
                        e.elementId AS eId, \
                        e.elementText AS eText, \
                        u.userId AS uId, \
                        u.screenname AS screenname \
                    FROM rangeDecisions rd \
                        JOIN rangeScales rs ON rd.rangeScaleId = rs.rangeScaleId \
                        JOIN rangeQuestions rq ON rs.rangeQuestionId = rq.rangeQuestionId \
                        JOIN elements e ON e.elementId = rd.elementId \
                        JOIN users u ON rd.userId = u.userId \
                    WHERE rq.taskId = ? \
					AND u.userId LIKE ? \
                    ORDER BY rq.rangeQuestionId", taskId, userId
                );

                taskDetails["labels"] = rangeAnswers;

                // Get counts of the users who have labeled this task
                var userLabelDetails = db.all(
                    "SELECT \
                        u.userId AS uId, \
                        u.screenname AS screenname, \
                        u.fname AS fname, \
                        u.lname AS lname, \
                        COUNT(*)/COUNT(DISTINCT(rs.rangeQuestionId)) AS count \
                    FROM rangeDecisions rd \
                        JOIN rangeScales rs ON rd.rangeScaleId = rs.rangeScaleId \
                        JOIN rangeQuestions rq ON rs.rangeQuestionId = rq.rangeQuestionId \
                        JOIN users u ON u.userId = rd.userId \
                    WHERE rq.taskId = ? \
					AND u.userId LIKE ? \
                    GROUP BY u.userId", taskId, userId);

                taskDetails["userDetails"] = userLabelDetails;

            } else {
                console.log("Unknown task type in taskStats/...");
                taskDetails["empty"] = true;
            }

            return Promise.props(taskDetails);
        })
        .then(function (taskInfoMap) {

            var taskInfo = taskInfoMap["taskInfo"];
            var labelDetails = taskInfoMap["labelOptions"];
            var userDetails = taskInfoMap["userDetails"];
            var taskDetails = taskInfoMap["labels"];



            // We need to fix up the range question array, so we
            //  can group by rangeQuestion rather than the range scales
            if (taskInfoMap["taskInfo"]["taskType"] == 3) {

                // Aggregate range questions, so we can match questions
                //  to their relevant scales
                var rangeQuestions = new Map();

                labelDetails.forEach(function(labelOption) {
                    var rangeQuestionId = labelOption["rqId"];

                    // if this is a new range question...
                    if ( !rangeQuestions.has(rangeQuestionId) ) {
                        // Create a default entry for this question
                        rangeQuestions.set(rangeQuestionId, {
                            "question": labelOption["rqQ"],
                            "options": new Array(),
                        });
                    }

                    var thisQuestionOptions = rangeQuestions.get(rangeQuestionId)["options"];
                    thisQuestionOptions.push({
                        "rsId": labelOption["rsId"],
                        "rsValue": labelOption["rsValue"],
                        "rsOrder": labelOption["rsOrder"],
                    });
                });

                // Update the label details with the map of range questions
                labelDetails = rangeQuestions;

                

                // Aggregate the labels, so we can show groups of range scales 
                //  for each element a user has labeled
                var labeledElements = new Map();

                taskDetails.forEach(function(labeledRangeScale) {
                    var thisElementId = labeledRangeScale["eId"];
                    var thisUserId = labeledRangeScale["uId"];

                    var thisLabelMapKey = `${thisElementId}-${thisUserId}`;

                    // if this is a new element-user pair...
                    if ( !labeledElements.has(thisLabelMapKey) ) {
                        // Create a default entry for this element
                        labeledElements.set(thisLabelMapKey, {
                            "uId": labeledRangeScale["uId"],
                            "screenname": labeledRangeScale["screenname"],
                            "eId": labeledRangeScale["eId"],
                            "eText": labeledRangeScale["eText"],
                            "labels": new Map(),
                        });
                    }

                    var thisLabeledRangeScale = labeledElements.get(thisLabelMapKey)["labels"];
                    thisLabeledRangeScale.set(labeledRangeScale["rqId"], {
                        "rdId": labeledRangeScale["rdId"],
                        "rsId": labeledRangeScale["rsId"],
                    });
                });

                // Update the label details with the map of range questions
                taskDetails = labeledElements;

            }

            // Calculate the agreement or quality of labels
            var agreementStats = calculateAgreement(taskInfo, taskDetails, userDetails);

            dataMap = {
                taskInfo: taskInfo,
                detailList: taskDetails,
                userDetails: userDetails,
                agreement: agreementStats,
                labelDetails: labelDetails
            }

            res.render('taskStats-detail', dataMap);
        });
})

// Send a list of the tasks for inspection
app.get('/export', function (req, res) {
    db.all("SELECT t.taskId, t.taskName, t.question, COUNT(c.compareId) AS counter \
		FROM tasks t \
			LEFT OUTER JOIN pairs p ON t.taskId = p.taskId \
			LEFT OUTER JOIN comparisons c ON p.pairId = c.pairId \
		WHERE t.taskType == 1 \
		GROUP BY t.taskId \
		ORDER BY t.taskId")
        .then(function (pairTaskData) {
            var labelTaskData = db.all("SELECT t.taskId, t.taskName, t.question, COUNT(DISTINCT(e.elementId)) AS eCount, COUNT(el.elementLabelId) AS labelCount \
            FROM tasks t \
            	LEFT OUTER JOIN elements e ON t.taskId = e.taskId \
            	LEFT OUTER JOIN elementLabels el ON e.elementId = el.elementId \
            WHERE t.taskType == 2 \
            GROUP BY t.taskId \
            ORDER BY t.taskId");

            return Promise.all([
                pairTaskData,
                labelTaskData
            ]);
        })
        .then(function (taskData) {

            var pairTaskData = taskData[0];
            var labelTaskData = taskData[1];
            var rangeData = db.all("SELECT t.taskId, t.taskName, t.question, COUNT(DISTINCT(e.elementId)) AS eCount, COUNT(rd.rangeQuestionId) AS labelCount \
            FROM tasks t \
              LEFT OUTER JOIN elements e ON t.taskId = e.taskId \
              LEFT OUTER JOIN rangeDecisions rd ON e.elementId = rd.elementId \
            WHERE t.taskType == 3 \
            GROUP BY t.taskId \
            ORDER BY t.taskId");

            return Promise.all([
                pairTaskData,
                labelTaskData,
                rangeData
            ]);

        }).then(function (taskData) {
            dataMap = {
                pairTasks: taskData[0],
                labelTasks: taskData[1],
                rangeTasks: taskData[2],
            }

            res.render('export', dataMap)
        });
})

// CSV Detailed view for a given task
app.get('/csv/:taskId', function (req, res) {
    var taskId = req.params.taskId;
    var comp = false;
    var range = false;

    db.get("SELECT taskName, question, taskType FROM tasks WHERE taskId = ?", taskId)
        .then(function (taskData) {

            var taskDetails = {
                taskInfo: taskData
            };

            if (taskData.taskType == 1) {

                var compDetails = db.all("SELECT c.decision, \
            e1.elementId AS lId, e1.elementText AS lText, e1.externalId AS lExt, \
            e2.elementId AS rId, e2.elementText AS rText, e2.externalId AS rExt \
          FROM pairs p \
            JOIN elements AS e1 ON e1.elementId = p.leftElement \
            JOIN elements AS e2 ON e2.elementId = p.rightElement \
            JOIN comparisons c ON p.pairId = c.pairId \
          WHERE p.taskId = ?", taskId);

                taskDetails["labels"] = compDetails;

                comp = true;

            } else if (taskData.taskType == 2) {

                var labelDetails = db.all("SELECT \
              e.elementId AS elementId, \
              e.externalId AS externalId, \
              e.elementText AS elementText, \
              u.userId AS labelerId, \
              u.screenname AS labelerScreenname, \
              l.labelId AS labelId, \
              l.labelText AS labelText, \
              l.parentLabel AS parentLabel, \
              pl.labelText AS parentLabelText \
            FROM elements e \
                JOIN elementLabels el ON e.elementId = el.elementId \
                JOIN labels l ON el.labelId = l.labelId \
                JOIN users u ON u.userId = el.userId \
                LEFT OUTER JOIN labels pl ON l.parentLabel = pl.labelId \
            WHERE e.taskId = ? \
            ORDER BY e.elementId", taskId);

                taskDetails["labels"] = labelDetails;

            } else if (taskData.taskType == 3) {

                var labelDetails = db.all("SELECT \
              e.elementId AS elementId, \
              e.externalId AS externalId, \
              e.elementText AS elementText, \
              u.userId AS labelerId, \
              u.screenname AS labelerScreenname, \
              rq.rangeQuestion AS rangeQuestion, \
              rs.rangeValue AS rangeValue, \
              rd.rangeScaleId AS rangeScaleId \
            FROM elements e \
                JOIN rangeDecisions rd ON e.elementId = rd.elementId \
                JOIN rangeQuestions rq ON rd.rangeQuestionId = rq.rangeQuestionId \
                JOIN rangeScales rs ON rd.rangeScaleId = rs.rangeScaleId \
                JOIN users u ON u.userId = labelerId \
            WHERE e.taskId = ? \
            ORDER BY e.elementId", taskId);

                taskDetails["ranges"] = labelDetails;

                range = true;

            } else {
                console.log("Unknown task type in json/...");
                taskDetails.push({ empty: true });
            }

            return Promise.props(taskDetails);
        })
        .then(function (taskInfoMap) {

            var taskDetails = taskInfoMap["labels"];
            var taskCSVToSend = "";

            if (comp) {
                taskCSVToSend = 'lId,lText,lExt,rId,rText,rExt\n';

                var concatStr = '';

                taskDetails.forEach(function (index) {
                    concatStr = (index['lId'] + ',' +
                        index['lText'] + ',' +
                        index['lExt'] + ',' +
                        index['rId'] + ',' +
                        index['rText'] + ',' +
                        index['rExt']);

                    taskCSVToSend += concatStr + '\n';
                })
            }
            else if (range) {
                var taskDetails = taskInfoMap["ranges"];

                taskCSVToSend = 'elementId,externalId,rangeQuestion,rangeQuestionId,rangeValue,rangeScaleId,labelerScreenname,labelerId\n';

                var concatStr = '';

                taskDetails.forEach(function (index) {
                    concatStr = index['elementId'] + ',' +
                        index['externalId'] + ',' +
                        index['rangeQuestion'] + ',' +
                        index['rangeQuestionId'] + ',' +
                        index['rangeValue'] + ',' +
                        index['rangeScaleId'] + ',' +
                        index['labelerScreenname'] + ',' +
                        index['labelerId'];

                    taskCSVToSend += concatStr + '\n';
                })
            }
            else {
                taskCSVToSend = 'elementId,externalId,chosenLabel,labelerId,lablerScreenname,labelId,labelText\n';

                var concatStr = '';

                taskDetails.forEach(function (index) {

                    concatStr = index['elementId'] + ',' +
                        index['externalId'] + ',' +
                        index['labelerId'] + ',' +
                        index['labelerScreenname'] + ',' +
                        index['labelId'] + ',' +
                        index['labelText'] + ',' +
                        index['parentLabel'] + ',' +
                        index['parentLabelText'];

                    taskCSVToSend += concatStr + '\n';
                })
            }


            res.set('Content-Type', 'text/csv');
            res.attachment('Task' + taskId + '.csv');
            res.send(taskCSVToSend);
        });
})


// JSON Detailed view for a given task
app.get('/json/:taskId', function (req, res) {
    var taskId = req.params.taskId

    db.get("SELECT taskName, question, taskType FROM tasks WHERE taskId = ?", taskId)
        .then(function (taskData) {

            var taskDetails = {
                taskInfo: taskData
            };

            if (taskData.taskType == 1) {

                var compDetails = db.all("SELECT c.decision, \
            e1.elementId AS lId, e1.elementText AS lText, e1.externalId AS lExt, \
            e2.elementId AS rId, e2.elementText AS rText, e2.externalId AS rExt \
          FROM pairs p \
            JOIN elements AS e1 ON e1.elementId = p.leftElement \
            JOIN elements AS e2 ON e2.elementId = p.rightElement \
            JOIN comparisons c ON p.pairId = c.pairId \
          WHERE p.taskId = ?", taskId);

                taskDetails["labels"] = compDetails;

            } else if (taskData.taskType == 2) {

                var labelDetails = db.all("SELECT \
              e.elementId AS elementId, \
              e.externalId externalId, \
              e.elementText AS elementText, \
              u.userId AS labelerId, \
              u.screenname AS labelerScreenname, \
              l.labelId AS labelId, \
              l.labelText AS labelText, \
              l.parentLabel AS parentLabel, \
              pl.labelText AS parentLabelText \
            FROM elements e \
                JOIN elementLabels el ON e.elementId = el.elementId \
                JOIN labels l ON el.labelId = l.labelId \
                JOIN users u ON u.userId = el.userId \
                LEFT OUTER JOIN labels pl ON l.parentLabel = pl.labelId \
            WHERE e.taskId = ? \
            ORDER BY e.elementId", taskId);

                taskDetails["labels"] = labelDetails;

            }
            else if (taskData.taskType == 3) {
                var rangeDetails = db.all("SELECT \
                rq.rangeQuestionId, \
                rq.rangeQuestion, \
                rs.rangeValue \
                FROM rangeQuestions rq, \
                rangeScales rs \
                WHERE rq.taskId = ? \
                ORDER BY rs.rangeOrder"
                    , taskId)

                taskDetails["labels"] = rangeDetails;
            }
            else {
                console.log("Unknown task type in json/...");
                taskDetails.push({ empty: true });
            }

            return Promise.props(taskDetails);
        })
        .then(function (taskInfoMap) {

            var taskDetails = taskInfoMap["labels"];

            res.json(taskDetails);
        });
})

// Send a list of the tasks
app.get('/taskView', function (req, res) {

    if (!("user" in req.session) || req.session.user === null) {

        console.log("User is not logged in...");
        res.redirect('/')

    } else if (req.session.user['isadmin']) {
        db.all('SELECT taskId, taskName, question, taskType FROM tasks t \
            ORDER BY t.taskId')
            .then(function (taskData) {
                dataMap = {
                    tasks: taskData,
                    authorized: req.session.user ? true : false,
                    user: req.session.user,
                }

                console.log(dataMap);

                res.render('taskView', dataMap)
            });
    }
    else {
        db.all('SELECT taskId, taskName, question, taskType FROM tasks t \
           JOIN assignedTasks at ON t.taskId = at.assignedTaskId \
            WHERE at.userId = ?  \
            ORDER BY t.taskId',
            req.session.user.userId)
            .then(function (taskData) {
                dataMap = {
                    tasks: taskData,
                    authorized: req.session.user ? true : false,
                    user: req.session.user,
                }

                console.log(dataMap);

                res.render('taskView', dataMap)
            });
    }
})


// Send the view for doing labeling
app.get('/rangeView/:id', function (req, res) {

    // Store the task ID in the session
    var requestedTask = req.params.id
    req.session.taskId = requestedTask

    var currentUser = req.session.user
    console.log("Current User Session: " + currentUser.screenname)

    db.get('SELECT taskName, question FROM tasks WHERE taskId = ?', requestedTask)
        .then(function (taskData) {
            taskMap = {
                taskId: requestedTask,
                taskName: taskData.taskName,
            }

            return Promise.all([
                taskMap,
                db.all('SELECT rq.rangeQuestionId, rq.rangeQuestion, rs.rangeScaleId, rs.rangeValue, rs.rangeOrder \
                        FROM rangeQuestions rq JOIN rangeScales rs \
                        ON rq.rangeQuestionId = rs.rangeQuestionId \
                        WHERE rq.taskId=? \
                        ORDER BY rs.rangeOrder', requestedTask)
            ]);
        })
        .then(function (rangeData) {

            var taskData = rangeData[0];
            var rangeQuestionList = rangeData[1];

            console.log("Result: ");
            console.log(taskData);
            console.log({ rangeQuestionList });

            var rangeQuestionMap = {};

            rangeQuestionList.forEach(element => {
                var rqId = element["rangeQuestionId"];

                if (!(rqId in rangeQuestionMap)) {
                    rangeQuestionMap[rqId] = {
                        "rangeQuestion": element["rangeQuestion"],
                        "scale": new Array(),
                    }
                }

                var thisRangeQuestion = rangeQuestionMap[rqId];
                thisRangeQuestion["scale"].push({
                    "rangeScaleId": element["rangeScaleId"],
                    "rangeScaleValue": element["rangeValue"],
                });
            });

            dataMap = {
                taskId: taskData.taskId,
                taskName: taskData.taskName,
                ranges: rangeQuestionMap,
                authorized: req.session.user ? true : false,
                user: req.session.user,
            }

            res.render('rangeView', dataMap)
        });
})

// Send a tweet for labeling
app.get('/range', function (req, res) {

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
			FROM rangeDecisions rd \
			WHERE rd.elementId = e.elementId \
			AND rd.userId = ?) == 0 \
	 	LIMIT 10', [requestedTask, localUser.userId])
        .then(function (elements) {

            if (elements.length > 0) {
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
app.post('/range', function (req, res) {
    console.log("Receive range Body: " + req.body);
    console.log("\telement: " + req.body.element);
    console.log("\tselected: " + req.body.selected);
    console.log("\tUser ID: " + req.session.user.userId);

    var elementId = req.body.element;
    var questionId = req.body.question;
    var userId = req.session.user.userId;
    var decision = req.body.selected;

    db.get('INSERT INTO rangeDecisions (elementId, rangeQuestionId, rangeScaleId, userId) \
	VALUES (:elementId, :rangeQuestionId, :decision, :userId)', [elementId, questionId, decision, userId])
        .then(function () {
            console.log("Decision logged...");
            res.end();
        });
})

// Send the view for doing labeling
app.get('/labelerView/:id', function (req, res) {

    if (!("user" in req.session) || req.session.user === null) {

        console.log("User is not logged in...");
        res.redirect('/')

        return;
    }

    // Store the task ID in the session
    var requestedTask = req.params.id
    req.session.taskId = requestedTask

    var currentUser = req.session.user
    console.log("Current User Session: " + currentUser.screenname)

    db.get('SELECT taskName, question FROM tasks WHERE taskId = ?', requestedTask)
        .then(function (taskData) {
            taskMap = {
                taskId: requestedTask,
                taskName: taskData.taskName,
                question: taskData.question,
            }

            return Promise.all([
                taskMap,
                db.all('SELECT labelId, labelText, parentLabel FROM labels WHERE taskId = ?', requestedTask)
            ]);
        })
        .then(function (labelData) {

            var taskData = labelData[0];
            var labelList = labelData[1];

            // A map of label IDs and their related metadata
            var labelMap = {};

            // populate the label map and create a children array
            labelList.forEach(element => {
                element['children'] = new Array();
                element['childrenIds'] = new Array();

                labelMap[element['labelId']] = element;
            });

            // Populate list of children for each label
            labelList.forEach(element => {
                if (element['parentLabel'] > 0) {
                    // Get the parent label from our map of labels
                    var parent = labelMap[element['parentLabel']];

                    // Add this element to the children list
                    parent['children'].push(element);
                    parent['childrenIds'].push(element['labelId']);
                }
            });

            // Set the button index for each label
            var topButtonIndex = 1;
            labelList.forEach(element => {
                if (element['parentLabel'] < 1) {

                    element['buttonIndex'] = topButtonIndex;
                    topButtonIndex++;

                }

                var localButtonIndex = 1;
                element['children'].forEach(child => {
                    child['buttonIndex'] = localButtonIndex;
                    localButtonIndex++;
                });
            });

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
app.get('/item', function (req, res) {

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
        .then(function (elements) {

            if (elements.length > 0) {
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
app.post('/item', function (req, res) {
    console.log("Receive label Body: " + req.body);
    console.log("\telement: " + req.body.element);
    console.log("\tselected: " + req.body.selected);
    console.log("\tUser ID: " + req.session.user.userId);

    var elementId = req.body.element;
    var userId = req.session.user.userId;
    var decision = req.body.selected;

    db.get('INSERT INTO elementLabels (elementId, userId, labelId) \
		VALUES (:elementId, :userId, :decision)', [elementId, userId, decision])
        .then(function () {
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
        .then(function (taskData) {
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
app.get('/pair', function (req, res) {

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
        .then(function (pairs) {

            if (pairs.length > 0) {
                var pairList = pairs.map(function (x) {
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
                return Promise.resolve({ empty: true });
            }
        })
        .then(function (tweets) {

            if (!("empty" in tweets)) {
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
                res.send(JSON.stringify({ empty: true }));
            }
        });
})

// Post pair results to the database
app.post('/pair', function (req, res) {
    console.log("Post pair Body: " + req.body);
    console.log("\tpair: " + req.body.pair);
    console.log("\tselected: " + req.body.selected);
    console.log("\tUser ID: " + req.session.user.userId);

    var pairId = req.body.pair;
    var userId = req.session.user.userId;
    var decision = req.body.selected;

    db.get('INSERT INTO comparisons (pairId, userId, decision) \
		VALUES (:pairId, :userId, :dec)', [pairId, userId, decision])
        .then(function () {
            console.log("Decision logged...");
            res.end();
        });
})

// Receive an updated tweet label
app.post('/updateLabel', function (req, res) {
    console.log("Update label Body: " + req.body);
    console.log("\tNew Label ID: " + req.body.newLabelId);
    console.log("\tElement Label ID: " + req.body.elementLabelId);

    // For now, we don't need the user id...
    // console.log("\tUser ID: " + req.session.user.userId);
    // var userId = req.session.user.userId;

    var elementLabelId = req.body.elementLabelId;
    var decision = req.body.newLabelId;

    db.get('UPDATE elementLabels SET labelId = :decision WHERE elementLabelId = :elementLabelId',
        [decision, elementLabelId])
        .then(function () {
            console.log("Update logged...");
            res.end();
        });
})

// Receive an updated tweet range-based question's decision
app.post('/updateRange', function (req, res) {
    console.log("Update label Body: " + req.body);
    console.log("\tNew Scale Decision: " + req.body.newScaleId);
    console.log("\tDecision ID: " + req.body.previousDecisionId);

    
	// Still no need for the userId, all decisions are tracked with a unique ID
	//var userId = req.session.user.userId;
	var prevDecision = req.body.previousDecisionId;
    var newDecision = req.body.newScaleId;

    db.get('UPDATE rangeDecisions SET rangeScaleId = :newDecision WHERE rangeDecisionId = :prevDecision',
        [newDecision, prevDecision])
        .then(function () {
            console.log("Update logged...");
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
        app.listen(config.port, function () {
            console.log('Starting server...')
        })
    })