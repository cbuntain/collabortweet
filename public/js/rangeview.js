var numQuestions;
var maxOrders;
var answers;
var selectedElement;

// Call when the document is ready
$(document).ready(function () {
	var firstSelected = false;
	var i; 
	var questionIndex;//which question div are we working on?

	loadDataElements();

	numQuestions = $("#rangeQuestionContainer#rangeQuestion").length;
	maxOrders = [];


	for (i = 0; i < numQuestions; i++) {
		maxOrders.push($("#rangeQuestionContainer#rangeQuestion input:radio").length);
	}
	
	//on first radio select, create next button
	$("input:radio").change(function () {
		if ($("#rangeQuestionContainer#rangeQuestion input:radio:checked").length > 0) {
			selectedElement = $("#rangeQuestionContainer#rangeQuestion input:radio:checked").val;//this gives the order/index of a scale value on radio selection
		}

		if (!firstSelected) {
			firstSelected = true;

			if (currentQuestion == numQuestions) {
				$("#rangeQuestionContainer#rangeQuestion").append(
					"<button type='button' class='btn btn-default' id='nextButton'>Next Question</button>"
				);
			}
			else {
				$("#rangeQuestionContainer#rangeQuestion").append(
					"<button type='button' class='btn btn-default' id='lastButton'>Submit Answers</button>"
				);
			}
		}
	});

	$("#nextButton").click(function () {
		if ($("#rangeQuestion" + (selectedElement )).hasClass("collapse")) {
			$("#rangeQuestion" + (selectedElement)).collapse("hide");
		}

		if ($("#rangeQuestion" + (selectedElement + 1)).hasClass("collapse")) {
			$("#rangeQuestion" + (selectedElement + 1)).collapse("show");
		}
	});

	$("#lastButton").click(function () {
		//post results to server
	});
});

var sendSelectedElement = function(elementId, selectedLabelId) {
	result = {
		element: elementId,
		selected: selectedLabelId,
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