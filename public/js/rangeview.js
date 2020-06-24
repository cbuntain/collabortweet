var numQuestions = 0;
var maxOrders = 0;
var answers = [];
var currentlySelected;
var submitAdded = false;

// Call when the document is ready
$(document).ready(function () {
	var i; 

	loadDataElements();

	numQuestions += $(".rangeQuestionContainer").length;
	maxScaleVals = [];

	for (i = 1; i < numQuestions; i++) {
		maxScaleVals.push($(".rangeQuestionContainer #rangeQuestion" + i + " input:radio").length);
	}

	//select only one radio button per question
	//show submit on all questions selected
	//send each taskId, question, decision
	for (i = 1; i < numQuestions+1; i++) {
		$(".rangeQuestionContainer #rangeQuestion" + i + " input:radio").change(function () {
			currentlySelected = this;

			$(':radio[name = "'+i+'"]').each((element) => {
				if (element != currentlySelected) {
					element.prop("checked", false);
				}
			});

			if ($(":checked").length == numQuestions && !submitAdded) {
				$(".questions").append(
					"<button type='button' class='btn btn-default' id='submit'>Submit Answers!</button>"
				);

				submitAdded = false;
			}
		});
	}
});

$(".questions").on("click", "button", function () {
	$("input[type=radio]:checked").each((element) => {
		console.log(element);
	});
});

var sendSelectedElement = function(question, decision) {
	result = {
		element: question,
		selected: decision,
	}

	$.post("/item", result, function(data) {
		console.log("Successfully sent selection...");
		loadDataElements();
	})

}

var handleButtonClick = function(thisButton) {
	var labelIndex = thisButton.attr('labelindex');
	var labelId = thisButton.attr('labelid');
	var parentId = thisButton.attr('parentid');
	var childIds = thisButton.data('childids');

	if (childIds.length == 0) {

		// Reset the selectable buttons...
		$('.ct-label').each(function() {
			var localParentId = $(this).attr('parentid');

			if ( localParentId < 1 ) {
				$(this).addClass('selected-label');
				$(this).removeClass('hidden-label');
			} else {
				$(this).removeClass('selected-label');
				$(this).addClass('hidden-label');
			}
			
		});

		sendSelectedElement(dataElement.elementId, labelId);
	} else {

		// Turn off all the selectable buttons...
		$('.selected-label').each(function() {
			$(this).removeClass('selected-label');
			$(this).addClass('hidden-label');
			
		});
		$('.hidden-label').each(function() {
			var localParentId = $(this).attr('parentid');

			// Add selected-label class to this index...
			if ( localParentId == labelId ) {
				$(this).removeClass('hidden-label');
				$(this).addClass('selected-label');
			}
		});

		// Rebuild the buttons display
		regenDisplayableButtons();
	}
}

var loadDataElements = function() {

	console.log("loadDataElements() called.");
	$("#loadingDialog").modal('show');

	$.get("/item", function(json) {
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

			// Set up the buttons...
			//regenDisplayableButtons();

			$("#loadingDialog").modal('hide');
			console.log("Loaded element...");
		}
	})

}