// Call when the document is ready
$( document ).ready(function() {
	console.log( "ready!" );

	loadTweets();
});

var sendSelectedTweet = function(pairId, selectedId) {
	result = {
		pair: pairId,
		selected: selectedId,
	}

	$.post("/pair", result, function(data) {
		console.log("Successfully sent selection...");
		loadTweets();
	})
}

var loadTweets = function() {

	console.log("loadTweets() called.");
	$("#loadingDialog").modal('show');

	$.get("/pair", function(json) {
		tweetPair = json;
		pairId = tweetPair.id;

		$("#left-tweet-panel").text(tweetPair.left.tweet.text);
		$("#right-tweet-panel").text(tweetPair.right.tweet.text);

		
		$(document).off("keypress").keypress(function(e) {

			switch(e.which) {
				case 65:
				case 97:
					sendSelectedTweet(pairId, tweetPair.left.tweet.id);
					break;

				case 66:
				case 98:
					sendSelectedTweet(pairId, tweetPair.right.tweet.id);
					break;

				case 67:
				case 99:
					sendSelectedTweet(pairId, -1);
					break;
			}
		});

		$("#left-tweet-button").off("click").click(function() {
			sendSelectedTweet(pairId, tweetPair.left.tweet.id);
		});
		$("#right-tweet-button").off("click").click(function() {
			sendSelectedTweet(pairId, tweetPair.right.tweet.id);
		});
		$("#undecided-button").off("click").click(function() {
			sendSelectedTweet(pairId, -1);
		});

		$("#loadingDialog").modal('hide');
		console.log("Loaded pair...");
	})

}