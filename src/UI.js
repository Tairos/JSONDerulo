function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("JSONDerulo")
    .addItem("Create sheet from JSON", "showJSONImportPopup")
    .addToUi();
}

function showJSONImportPopup() {
  var html = HtmlService.createHtmlOutputFromFile("ImportPopup")
    .setWidth(600)
    .setHeight(460);
  SpreadsheetApp.getUi().showModalDialog(html, "JSONDerulo Importer");
}

// Called from ImportPopup.html. Errors are thrown so the popup can show them.
function processJSONForm(form) {
  var json;
  try {
    json = JSON.parse(form.json);
  }
  catch (error) {
    throw new Error("That's not valid JSON: " + error.message);
  }

  return createNewSheet(json, (form.name || "").trim());
}
