// Lays a JSON value out as a grid of cells whose formulas rebuild that same
// JSON. This file only builds the grid; SheetController.js writes it.
//
// The whole JSON goes on one row, so the row can be dragged down to make more
// items with the same structure: titles in row 1, headers in row 2 and the
// first item in row 3. Left to right:
// - A3 holds the result: the formula that rebuilds the JSON.
// - An object is a block of columns (nested objects use dotted headers),
//   rebuilt with =ToJSON(B$2:D$2, B3:D3).
// - A list is a block of columns headed [0], [1]..., rebuilt with
//   =ToJSONList(F3:H3).
// - Nested objects and lists get their own block further right, after an
//   empty column, titled with their path (e.g. "↳ value.Items[0]"). The cell
//   that holds them gets the formula.
// - Property names that can't be plain headers (with dots, empty, or starting
//   with = ' or ") are written in quotes, which ToJSON reads as one literal key.
//
// Headers are referenced with a fixed row ($2) and values with a relative
// one, so formulas copied down read their own row.

var TITLE_ROW = 1;
var HEADER_ROW = 2;
var VALUE_ROW = 3;

// separator is the formula argument separator: "," or ";" depending on the
// spreadsheet locale (see formulaSeparator).
function layoutJSON(json, separator) {
  var grid = { cells: {}, textCells: [], rows: VALUE_ROW, columns: 1, nextColumn: 2, separator: separator || "," };
  setCell(grid, HEADER_ROW, 1, "JSON", true);

  if (isNestedValue(json)) {
    writeInto(grid, 1, json, "", true);
  }
  else {
    setCell(grid, VALUE_ROW, 1, checkTextLength(JSON.stringify(json)), true);
  }

  return finishGrid(grid);
}

// Writes the value into the value row of the given column. Nested objects and
// lists get a block of their own and the column gets the formula.
function writeInto(grid, column, value, path, isRoot) {
  if (isNestedObject(value)) {
    writeObject(grid, column, value, path, isRoot);
  }
  else if (isNestedList(value)) {
    writeList(grid, column, value, path, isRoot);
  }
  else {
    writeScalar(grid, VALUE_ROW, column, value);
  }
}

function writeObject(grid, column, object, path, isRoot) {
  var entries = flattenObject(object, "");
  var start = allocateBlock(grid, entries.length, path, isRoot);
  var end = start + entries.length - 1;

  for (var i = 0; i < entries.length; i++) {
    setCell(grid, HEADER_ROW, start + i, entries[i].header, true);
  }

  var headers = columnA1(start) + "$" + HEADER_ROW + ":" + columnA1(end) + "$" + HEADER_ROW;
  var values = rangeA1(VALUE_ROW, start, VALUE_ROW, end);
  setCell(grid, VALUE_ROW, column, "=ToJSON(" + headers + grid.separator + " " + values + ")", false);

  for (var i = 0; i < entries.length; i++) {
    writeInto(grid, start + i, entries[i].value, joinPath(path, entries[i].label), false);
  }
}

function writeList(grid, column, list, path, isRoot) {
  var start = allocateBlock(grid, list.length, path, isRoot);

  for (var i = 0; i < list.length; i++) {
    setCell(grid, HEADER_ROW, start + i, "[" + i + "]", true);
  }

  setCell(grid, VALUE_ROW, column, "=ToJSONList(" + rangeA1(VALUE_ROW, start, VALUE_ROW, start + list.length - 1) + ")", false);

  for (var i = 0; i < list.length; i++) {
    writeInto(grid, start + i, list[i], path + "[" + i + "]", false);
  }
}

// Locales that write 1,5 instead of 1.5 separate formula arguments with ";".
function formulaSeparator(locale) {
  return usesDecimalComma(locale) ? ";" : ",";
}

function usesDecimalComma(locale) {
  var tag = String(locale || "en_US").replace(/_/g, "-");
  try {
    if (Intl.NumberFormat.supportedLocalesOf([tag]).length > 0) {
      return new Intl.NumberFormat(tag).format(1.5).indexOf(",") != -1;
    }
  }
  catch (e) {
    // Unknown tag: fall back to the language list below.
  }

  var language = tag.split("-")[0].toLowerCase();
  return DECIMAL_COMMA_LANGUAGES.indexOf(language) != -1;
}

var DECIMAL_COMMA_LANGUAGES = [
  "az", "be", "bg", "bs", "ca", "cs", "da", "de", "el", "es", "et", "eu", "fi", "fr", "gl", "hr", "hu",
  "hy", "id", "is", "it", "ka", "kk", "lt", "lv", "mk", "nb", "nl", "nn", "no", "pl", "pt", "ro", "ru",
  "sk", "sl", "sq", "sr", "sv", "tr", "uk", "uz", "vi",
];

// Writes a value so that parseValue reads back exactly the same value.
// Text cells get the plain text number format, so Sheets keeps "007" or
// "2024-01-01" as text instead of turning them into numbers or dates.
function writeScalar(grid, row, column, value) {
  if (typeof value === 'number' || typeof value === 'boolean') {
    setCell(grid, row, column, value, false);
  }
  else if (value === null) {
    setCell(grid, row, column, "null", true);
  }
  else if (isString(value)) {
    setCell(grid, row, column, checkTextLength(needsQuotes(value) ? JSON.stringify(value) : value), true);
  }
  else {
    // Empty objects and lists are written as JSON text.
    setCell(grid, row, column, checkTextLength(JSON.stringify(value)), true);
  }
}

// Text that parseValue would read as something else, or that Sheets would
// treat specially, is written in quotes.
function needsQuotes(text) {
  return text.length == 0 ||
    text == "null" ||
    /^(true|false)$/i.test(text) ||
    isNumeric(text) ||
    /^[='"]/.test(text) ||
    /^[\[{"]/.test(text.trim());
}

// A property name can be a plain header if it's not empty, has no dots (they
// would nest it) and doesn't start with a character that Sheets or ToJSON
// treats specially. Other names are written in quotes.
function isHeaderSafe(key) {
  return key.length > 0 && key.indexOf(".") == -1 && !/^[=']/.test(key) && !/^\s*"/.test(key);
}

function isNestedObject(value) {
  return isObject(value) && Object.keys(value).length > 0;
}

// Objects that can be merged into their parent's headers with dots.
function isFlattenable(value) {
  return isNestedObject(value) && Object.keys(value).every(isHeaderSafe);
}

function isNestedList(value) {
  return Array.isArray(value) && value.length > 0;
}

function isNestedValue(value) {
  return isNestedObject(value) || isNestedList(value);
}

// Turns {"a":{"b":1},"c":2} into headers a.b and c with their values.
// The label is the readable path used for nested blocks.
function flattenObject(object, prefix) {
  var entries = [];
  for (var key of Object.keys(object)) {
    var path = prefix + key;
    if (!isHeaderSafe(key)) {
      // Only the top level of a block can get here: flattenable objects have no such keys.
      entries.push({ header: JSON.stringify(key), label: prefix + JSON.stringify(key), value: object[key] });
    }
    else if (isFlattenable(object[key])) {
      entries = entries.concat(flattenObject(object[key], path + "."));
    }
    else {
      entries.push({ header: path, label: path, value: object[key] });
    }
  }
  return entries;
}

function joinPath(path, key) {
  return path.length == 0 ? key : path + "." + key;
}

// Reserves the columns for a block and returns the first one. Nested blocks
// get an empty column before them and their path as the title.
function allocateBlock(grid, width, path, isRoot) {
  if (!isRoot) {
    grid.nextColumn++;
  }

  var start = grid.nextColumn;
  grid.nextColumn += width;
  if (!isRoot) {
    setCell(grid, TITLE_ROW, start, "↳ " + path, true);
  }
  return start;
}

function setCell(grid, row, column, value, isText) {
  grid.cells[row + "," + column] = value;
  if (isText) {
    grid.textCells.push([row, column]);
  }
  grid.rows = Math.max(grid.rows, row);
  grid.columns = Math.max(grid.columns, column);
}

function finishGrid(grid) {
  var values = [];
  for (var r = 1; r <= grid.rows; r++) {
    var row = [];
    for (var c = 1; c <= grid.columns; c++) {
      var key = r + "," + c;
      row.push(hasKey(grid.cells, key) ? grid.cells[key] : "");
    }
    values.push(row);
  }

  return { values: values, textCells: grid.textCells, rows: grid.rows, columns: grid.columns };
}

function checkTextLength(text) {
  if (text.length > MAX_CELL_LENGTH) {
    throw new Error("A value is " + text.length + " characters, but a Sheets cell holds at most " + MAX_CELL_LENGTH);
  }
  return text;
}

function columnA1(column) {
  var letters = "";
  while (column > 0) {
    var remainder = (column - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    column = Math.floor((column - 1) / 26);
  }
  return letters;
}

function cellA1(row, column) {
  return columnA1(column) + row;
}

function rangeA1(row, column, lastRow, lastColumn) {
  return cellA1(row, column) + ":" + cellA1(lastRow, lastColumn);
}
