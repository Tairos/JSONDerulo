// Lays a JSON value out as a grid of cells whose formulas rebuild that same
// JSON. This file only builds the grid; SheetController.js writes it.
//
// Layout, left to right:
// - A1 is a label and A2 holds the result: the formula that rebuilds the JSON.
// - An object is a block of columns: property names in row 1, values in row 2,
//   rebuilt with =ToJSON(<block>).
// - A list of objects that all have the same properties is a table: one row
//   per object, rebuilt with =ToJSON(<table>).
// - Any other list is one column of items from row 2 down, rebuilt with
//   =ToJSONList(<column>).
// - Nested objects and lists get their own block further right, and the cell
//   that holds them gets the formula. The empty column before each nested
//   block has its path in row 1, e.g. value.Rewards[0].
//
// Every formula takes a single range, so it works with both "," and ";"
// argument separators (the spreadsheet locale decides which one is used).

function layoutJSON(json) {
  var grid = { cells: {}, textCells: [], rows: 2, columns: 1, nextColumn: 2 };
  setCell(grid, 1, 1, "JSON", true);

  if (isNestedObject(json) || isNestedList(json)) {
    writeInto(grid, 2, 1, json, "", true);
  }
  else {
    setCell(grid, 2, 1, checkTextLength(JSON.stringify(json)), true);
  }

  return finishGrid(grid);
}

function writeInto(grid, row, column, value, path, isRoot) {
  if (isNestedObject(value)) {
    writeObject(grid, row, column, value, path, isRoot);
  }
  else if (isTable(value)) {
    writeTable(grid, row, column, value, path, isRoot);
  }
  else if (isNestedList(value)) {
    writeList(grid, row, column, value, path, isRoot);
  }
  else {
    writeScalar(grid, row, column, value);
  }
}

function writeObject(grid, row, column, object, path, isRoot) {
  var entries = flattenObject(object, "");
  var start = allocateBlock(grid, entries.length, path, isRoot);

  for (var i = 0; i < entries.length; i++) {
    setCell(grid, 1, start + i, entries[i].path, true);
    if (!isNestedValue(entries[i].value)) {
      writeScalar(grid, 2, start + i, entries[i].value);
    }
  }

  setCell(grid, row, column, "=ToJSON(" + rangeA1(1, start, 2, start + entries.length - 1) + ")", false);

  for (var i = 0; i < entries.length; i++) {
    if (isNestedValue(entries[i].value)) {
      writeInto(grid, 2, start + i, entries[i].value, joinPath(path, entries[i].path), false);
    }
  }
}

function writeTable(grid, row, column, list, path, isRoot) {
  var rows = list.map(object => flattenObject(object, ""));
  var start = allocateBlock(grid, rows[0].length, path, isRoot);

  for (var c = 0; c < rows[0].length; c++) {
    setCell(grid, 1, start + c, rows[0][c].path, true);
    for (var r = 0; r < rows.length; r++) {
      writeScalar(grid, 2 + r, start + c, rows[r][c].value);
    }
  }

  setCell(grid, row, column, "=ToJSON(" + rangeA1(1, start, rows.length + 1, start + rows[0].length - 1) + ")", false);
}

function writeList(grid, row, column, list, path, isRoot) {
  var start = allocateBlock(grid, 1, path, isRoot);
  setCell(grid, 1, start, "items", true);

  for (var i = 0; i < list.length; i++) {
    if (!isNestedValue(list[i])) {
      writeScalar(grid, 2 + i, start, list[i]);
    }
  }

  setCell(grid, row, column, "=ToJSONList(" + rangeA1(2, start, list.length + 1, start) + ")", false);

  for (var i = 0; i < list.length; i++) {
    if (isNestedValue(list[i])) {
      writeInto(grid, 2 + i, start, list[i], path + "[" + i + "]", false);
    }
  }
}

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
    // Empty objects and lists, and objects whose property names can't be
    // headers, are written as JSON text.
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

// A property name can be a header if it's not empty, has no dots (they would
// nest it) and doesn't start with a character Sheets treats specially.
function isHeaderSafe(key) {
  return key.length > 0 && key.indexOf(".") == -1 && !/^[=']/.test(key);
}

function isNestedObject(value) {
  return isObject(value) && Object.keys(value).length > 0 && Object.keys(value).every(isHeaderSafe);
}

function isNestedList(value) {
  return Array.isArray(value) && value.length > 0;
}

function isNestedValue(value) {
  return isNestedObject(value) || isNestedList(value);
}

// Turns {"a":{"b":1},"c":2} into [{path:"a.b", value:1}, {path:"c", value:2}].
function flattenObject(object, prefix) {
  var entries = [];
  for (var key of Object.keys(object)) {
    var path = prefix + key;
    if (isNestedObject(object[key])) {
      entries = entries.concat(flattenObject(object[key], path + "."));
    }
    else {
      entries.push({ path: path, value: object[key] });
    }
  }
  return entries;
}

// A list of two or more objects with the same properties, in the same order,
// and no nested lists or objects inside.
function isTable(value) {
  if (!Array.isArray(value) || value.length < 2 || !value.every(isNestedObject)) {
    return false;
  }

  var paths = null;
  for (var object of value) {
    var entries = flattenObject(object, "");
    if (entries.some(entry => isNestedValue(entry.value))) {
      return false;
    }

    var objectPaths = entries.map(entry => entry.path).join("\n");
    if (paths !== null && objectPaths !== paths) {
      return false;
    }
    paths = objectPaths;
  }

  return true;
}

function joinPath(path, key) {
  return path.length == 0 ? key : path + "." + key;
}

// Reserves the columns for a block and returns the first one. Nested blocks
// get an extra column before them, labelled with their path.
function allocateBlock(grid, width, path, isRoot) {
  if (!isRoot) {
    setCell(grid, 1, grid.nextColumn, path, true);
    grid.nextColumn++;
  }

  var start = grid.nextColumn;
  grid.nextColumn += width;
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
