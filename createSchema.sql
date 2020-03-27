CREATE TABLE IF NOT EXISTS tasks (
	taskId INTEGER PRIMARY KEY,
	taskName TEXT,
	question TEXT,
	taskType INTEGER
);

CREATE TABLE IF NOT EXISTS users (
	userId INTEGER PRIMARY KEY,
	screenname TEXT UNIQUE NOT NULL,
	password TEXT NOT NULL,
	fname TEXT,
	lname TEXT,
	isadmin BIT
);

CREATE TABLE IF NOT EXISTS elements (
	elementId INTEGER PRIMARY KEY,
	elementText TEXT NOT NULL,
	taskId INTEGER NOT NULL,
	externalId TEXT
);

CREATE TABLE IF NOT EXISTS labels (
	labelId INTEGER PRIMARY KEY,
	labelText TEXT NOT NULL,
	taskId INTEGER NOT NULL,
	parentLabel INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS elementLabels (
	elementLabelId INTEGER PRIMARY KEY,
	elementId INTEGER NOT NULL,
	labelId INTEGER NOT NULL,
	userId INTEGER NOT NULL,
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS pairs (
	pairId INTEGER PRIMARY KEY,
	taskId INTEGER NOT NULL,
	leftElement INTEGER NOT NULL,
	rightElement INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comparisons (
	compareId INTEGER PRIMARY KEY,
	pairId INTEGER NOT NULL,
	userId INTEGER NOT NULL,
	decision INTEGER NOT NULL
);

CREATE VIEW pairChoices AS SELECT
	els.elementId AS elementId, els.taskId as taskId, COUNT(cps.compareId) AS counter
	FROM 
	elements els 
	LEFT OUTER JOIN pairs prs ON 
		els.elementId = prs.leftElement OR els.elementId = prs.rightElement
	LEFT OUTER JOIN comparisons cps ON cps.pairId = prs.pairId
	GROUP BY els.elementId;

