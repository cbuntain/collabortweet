// Call when the document is ready
$( document ).ready(function() {
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

var handleNavClick = function(pageSize, pageCursor) {

    var rowCount = $('.reviewable-row').length;

    $('.reviewable-row').each(function() {
        var thisRowId = $(this).attr("rowindex");

        if ( thisRowId >= ((pageCursor - 1) * pageSize) && thisRowId < (pageCursor * pageSize) ) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });

    if ( pageCursor <= 1 ) {
        $('#pre-button').addClass("disabled");
    } else {
        $('#pre-button').removeClass("disabled");
        $('#pre-button').off("click").click(function() {
           handleNavClick(pageSize, pageCursor - 1);
        });
    }

    if ( pageCursor * pageSize >= rowCount ) {
        $('#next-button').addClass("disabled");
    } else {
        $('#next-button').removeClass("disabled");
        $('#next-button').off("click").click(function() {
           handleNavClick(pageSize, pageCursor + 1);
        });
    }
}

var loadDataElements = function() {

    var pageSize = 10;
    var pageCursor = 1;

    handleNavClick(pageSize, pageCursor);    

    $('#next-button').off("click").click(function() {
       handleNavClick(pageSize, pageCursor + 1);
    });

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

    $('[id^="update-range-"]').change(function () {

        // The element-label ID pair is part of the form...
        var elementLabelId = $(this).attr('elementlabelid');

        // We need the button in this form.
        var form = $(this);

        // Set the click function for this form's button to
        //. update the element-label pair with the selected option
        // Need to send the rqid, rsId (decision id) and element id
        $('input:radio:checked').each(function (index) {
            var questionLabel = form.attr('id');

            var splitText = questionLabel.split('-');
            var rqId = splitText[splitText.length - 1];

            var rangeQuestionAndScaleId = {
                rangeQuestionId: rqId,
                decisionId : index.val
            }

            updateSelectedElement(elementLabelId, rangeQuestionAndScaleId);
        });
    });
}