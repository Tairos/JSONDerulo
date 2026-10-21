// The "JSONDerulo dev" menu, only pushed by `npm run push:dev` (see
// scripts/build-dev.js). DEV_EXAMPLES and DEV_SCRIPT_ID come from the
// generated DevData.js. A normal `npm run push` removes both files again.

// Called from onOpen in UI.js. Only adds the menu: nothing runs until you use it.
function onOpenDev() {
  if (!isDevScript()) {
    return;
  }

  SpreadsheetApp.getUi()
    .createMenu("JSONDerulo dev")
    .addItem("Import missing examples", "importDevExamples")
    .addItem("Re-import all examples", "reimportDevExamples")
    .addToUi();
}

// A copy of the spreadsheet gets a new script ID, so copies never show the menu.
function isDevScript() {
  return ScriptApp.getScriptId() === DEV_SCRIPT_ID;
}

// Imports each example that doesn't have a tab yet and adds missing checks.
function importDevExamples() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var first = null;
  for (var name of Object.keys(DEV_EXAMPLES)) {
    var sheet = spreadsheet.getSheetByName(name);
    try {
      if (sheet == null) {
        createNewSheet(DEV_EXAMPLES[name], name);
        sheet = spreadsheet.getSheetByName(name);
        first = first || name;
      }
      if (sheet.getRange(TITLE_ROW, 1).getFormula() == "" && sheet.getRange(TITLE_ROW, 1).getValue() == "") {
        addImportCheck(sheet, DEV_EXAMPLES[name]);
      }
    }
    catch (error) {
      spreadsheet.toast(error.message, name + " failed", 30);
    }
  }
  if (first) {
    spreadsheet.getSheetByName(first).activate();
  }
}

// Deletes the Example tabs, then imports them again with the current code.
function reimportDevExamples() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  for (var name of Object.keys(DEV_EXAMPLES)) {
    var sheet = spreadsheet.getSheetByName(name);
    if (sheet != null) {
      spreadsheet.deleteSheet(sheet);
    }
  }
  importDevExamples();
}

// Row 1 is never dragged down, so the check goes there: the original JSON two
// columns after the last block, and A1 says whether A3 still matches it.
function addImportCheck(sheet, json) {
  var expected = JSON.stringify(json);
  var check = sheet.getRange(TITLE_ROW, 1);
  if (expected.length > MAX_CELL_LENGTH) {
    check.setValue("too big to check");
    return;
  }

  var column = sheet.getLastColumn() + 2;
  ensureSheetSize(sheet, VALUE_ROW, column + 1);
  sheet.getRange(TITLE_ROW, column).setValue("original JSON →");
  var original = sheet.getRange(TITLE_ROW, column + 1).setNumberFormat("@").setValue(expected);

  var separator = formulaSeparator(SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetLocale());
  check.setFormula("=IF(EXACT(A" + VALUE_ROW + separator + " " + original.getA1Notation() + ")" +
    separator + ' "✓ matches"' + separator + ' "✗ differs")');
}
