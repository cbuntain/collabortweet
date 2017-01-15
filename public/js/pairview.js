// Call when the document is ready
$( document ).ready(function() {
	console.log( "ready!" );

	loadTweets();
});

var leftSelect = function() {
	result = {
		pair: pairId,
		selected: tweetPair.left.tweet.id,
	}

	$.post("/pair", result, function(data) {
		console.log("Successfully sent selection...");
		loadTweets();
	})
}

var rightSelect = function() {
	result = {
		pair: pairId,
		selected: tweetPair.right.tweet.id,
	}

	$.post("/pair", result, function(data) {
		console.log("Successfully sent selection...");
		loadTweets();
	})
}

var undecideSelect = function() {
	result = {
		pair: pairId,
		selected: -1,
	}

	$.post("/pair", result, function(data) {
		console.log("Successfully sent selection...");
		loadTweets();
	})
}

var loadTweets = function() {

	console.log("loadTweets() called.");

	$.get("/pair", function(json) {
		tweetPair = json;
		pairId = tweetPair.id;

		$("#left-tweet-panel").text(tweetPair.left.tweet.text);
		$("#right-tweet-panel").text(tweetPair.right.tweet.text);

		
		$(document).off("keypress").keypress(function(e) {

			switch(e.which) {
				case 65:
				case 97:
					leftSelect();
					break;

				case 66:
				case 98:
					rightSelect();
					break;

				case 67:
				case 99:
					undecideSelect();
					break;
			}
		});

		$("#left-tweet-button").off("click").click(leftSelect);
		$("#right-tweet-button").off("click").click(rightSelect);
		$("#undecided-button").off("click").click(undecideSelect);

		console.log("Loaded pair...");
	})

}