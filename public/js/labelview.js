// Call when the document is ready
$( document ).ready(function() {
	loadDataElements();
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

var regenDisplayableButtons = function() {
	console.log("Called regen...");

	// turn off the keypress function
	$(document).off("keypress");

	$('.hidden-label').each(function() {
		$(this).off("click");
		$(this).hide();
	});

	$('.selected-label').each(function() {
		var labelIndex = $(this).attr('labelindex');

		$(this).show();

		// Set the click function for this label ID
		$(this).off("click").click(function() {
			handleButtonClick($(this));
		});

		// Set the keypress for this label
		var thisButton = $(this);
		$(document).keypress(function(e) {
			if ( e.which-48 == labelIndex ) {
				handleButtonClick(thisButton);
			}
		});		

	});
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
			regenDisplayableButtons();

			$("#loadingDialog").modal('hide');
			console.log("Loaded element...");
		}
	})

}