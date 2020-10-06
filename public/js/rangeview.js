var numQuestions = 0;
var answers = [];
var currentlySelected;
var submitAdded = false;
var questionIndex = 0;

// Call when the document is ready
$(document).ready(function () {
	var i; 

	numQuestions = $(".rangeQuestionContainer .row").length;

	loadDataElements();

	questionIndex = numQuestions;

	$("input:radio").change(function () {
		currentlySelected = $(this);

		$('input:radio').each((index, element) => {
			if ($(element).id != currentlySelected.id) {
				$(element).prop("checked", false);
			}
		});

		if ($(":checked").length == numQuestions) {
			$(":checked").each((index, element) => {
				var rangeId = $(element).prop("id").split("-")[1];

				answers.push([$(element).prop("name"), rangeId, dataElement.elementId])
			});

			if (!submitAdded) {
				$(".btn").removeClass("collapse");

				submitAdded = true;
			}
		}
	});
});

var readyHTMLElements = function () {
	questionIndex += numQuestions;

	console.log("Question index: " + questionIndex);

	$("input:radio").change(function () {
		currentlySelected = $(this);

		$('input:radio').each((index, element) => {
			if ($(element).id != currentlySelected.id) {
				$(element).prop("checked", false);
			}
		});

		if ($(":checked").length == numQuestions) {
			$(":checked").each((index, element) => {
				var rangeId = $(element).prop("id").split("-")[1];

				answers.push([$(element).prop("name"), rangeId, dataElement.elementId])
			});

			if (!submitAdded) {
				$(".btn").removeClass("collapse");

				submitAdded = true;
			}
		}
	});
}

$(".container > .btn").click(function() {	
	var k;
	for (k = questionIndex - numQuestions; k < answers.length; k++) {
		console.log("k " + k);

		console.log("Sending " + answers[k][0] + " " + answers[k][1] + " " + answers[k][2]);

		sendSelectedElement(answers[k][0], answers[k][1], answers[k][2]);
	}

	$(":checked").each((index, element) => {
		$(element).prop("checked", false);
	});

	$(".btn").addClass("collapse");

	var i;
	for (i = 0; i < answers.length; i++) {
		answers[i].pop();
	}

	while (answers.length) {
		answers.pop();
	}

	currentlySelected = null;
	submitAdded = false;

	loadDataElements();

	readyHTMLElements();

	console.log({ answers });

});

var sendSelectedElement = function(questionId, decisionId, elementId) {
	result = {
		element: elementId,
		question: questionId,
		selected: decisionId,
	}

	$.post("/range", result, function(data) {
		console.log("Successfully sent selection...");	
	})

}

var loadDataElements = function() {

	console.log("loadDataElements() called.");
	$("#loadingDialog").modal('show');

	$.get("/range", function(json) {
		dataElement = json;

		if ( "empty" in dataElement ) {
			$("#loadingDialog").modal('hide');

			alert("You have no more elements in this task!");
			console.log("You have no more elements in this task!");

			// turn off the keypress function
			$(document).off("keypress");

			$('.hidden-label').each(function() {
				$(this).off("click");
				$(this).hide();
			});

			$('.selected-label').each(function() {
				$(this).off("click");
				$(this).hide();	
			});

		} else {
			console.log("Acquired element...");

			$("#element-content-panel").html(dataElement.elementText);

			$("#loadingDialog").modal('hide');
			console.log("Loaded element...");
		}
	})

}