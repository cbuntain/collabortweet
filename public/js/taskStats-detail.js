// Call when the document is ready
$( document ).ready(function() {
    console.log( "ready!" );

    loadDataElements();
});

var updateSelectedElement = function(elementLabelId, labelId) {
    result = {
        elementLabelId: elementLabelId,
        newLabelId: labelId,
    }

    $.post("/updateLabel", result, function(data) {
        console.log("Successfully sent update...");
    })
}

var loadDataElements = function() {

    $('.update-label').each(function() {
        // The element-label ID pair is part of the form...
        var elementLabelId = $(this).attr('elementlabelid');

        // We need the button in this form.
        var form = $(this);
        var button = $(this).children("input");

        // Set the click function for this form's button to
        //. update the element-label pair with the selected option
        button.off("click").click(function() {
            var selectedLabelId = form.children("select").children("option:selected").val();
            updateSelectedElement(elementLabelId, selectedLabelId);
        });
    });
}