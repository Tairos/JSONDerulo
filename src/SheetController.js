// Google Sheets limits.
var MAX_SHEET_COLUMNS = 18278;
var MAX_SPREADSHEET_CELLS = 10000000;

// Writes the JSON on a new tab and returns the tab's name.
function createNewSheet(json, name) {
  var layout = layoutJSON(json);
  if (layout.columns > MAX_SHEET_COLUMNS) {
    throw new Error("This JSON needs " + layout.columns + " columns, but a sheet holds at most " + MAX_SHEET_COLUMNS);
  }
  if (layout.rows * layout.columns > MAX_SPREADSHEET_CELLS) {
    throw new Error("This JSON needs " + (layout.rows * layout.columns) + " cells, but a spreadsheet holds at most " + MAX_SPREADSHEET_CELLS);
  }

  var sheet = createNewTab(name);
  ensureSheetSize(sheet, layout.rows, layout.columns);

  // Everything is written in a few calls, so big JSONs don't run into the
  // Apps Script time limit. Text formats go first so Sheets keeps text as text.
  var range = sheet.getRange(1, 1, layout.rows, layout.columns);
  var formats = range.getNumberFormats();
  layout.textCells.forEach(cell => { formats[cell[0] - 1][cell[1] - 1] = "@"; });
  range.setNumberFormats(formats);
  range.setValues(layout.values);

  sheet.getRange(1, 1, 1, layout.columns).setFontWeight("bold");
  sheet.setFrozenRows(1);
  SpreadsheetApp.flush();
  return sheet.getName();
}

function createNewTab(name) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (name) {
    if (spreadsheet.getSheetByName(name) != null) {
      throw new Error('There is already a tab called "' + name + '"');
    }
  }
  else {
    var i = 0;
    while (spreadsheet.getSheetByName(getNewSheetName(i)) != null) {
      i++;
    }
    name = getNewSheetName(i);
  }

  var sheet = spreadsheet.insertSheet(name);
  sheet.activate();
  return sheet;
}

function getNewSheetName(iteration) {
  return "ImportedJSON (" + iteration + ")";
}

function ensureSheetSize(sheet, rows, columns) {
  if (sheet.getMaxRows() < rows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < columns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), columns - sheet.getMaxColumns());
  }
}
