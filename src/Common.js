// Google Sheets cells hold at most this many characters.
var MAX_CELL_LENGTH = 50000;

function isString(value) {
  return (typeof value === 'string' || value instanceof String);
}

function isEmptyCell(value) {
  return value === '' || value === null || value === undefined;
}

function isObject(value) {
  return typeof value === 'object' && !Array.isArray(value) && value !== null;
}

function isNumeric(str) {
  if (typeof str != "string") return false // we only process strings!
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
         !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

function isDate(value) {
  return Object.prototype.toString.call(value) === '[object Date]';
}

function isStringJSONObject(value) {
  return isString(value) && value.startsWith("{") && value.endsWith("}");
}

function isStringJSONArray(value) {
  return isString(value) && value.startsWith("[") && value.endsWith("]");
}

function isStringJSONString(value) {
  return isString(value) && value.length >= 2 && value.startsWith('"') && value.endsWith('"');
}

// Sets a key as an own property, so names like "__proto__" are stored as data.
function setKey(object, key, value) {
  Object.defineProperty(object, key, { value: value, enumerable: true, writable: true, configurable: true });
}

function hasKey(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function pad(number) {
  return (number < 10 ? '0' : '') + number;
}

// Dates come from Sheets as Date objects. Format them in the spreadsheet's
// time zone (what the user sees in the cell), not in UTC.
function formatDate(date) {
  var hasTime = false;
  if (typeof Utilities !== 'undefined' && typeof SpreadsheetApp !== 'undefined') {
    var timeZone = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
    hasTime = Utilities.formatDate(date, timeZone, 'HH:mm:ss') !== '00:00:00';
    return Utilities.formatDate(date, timeZone, hasTime ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
  }

  var day = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  hasTime = date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
  if (!hasTime) {
    return day;
  }
  return day + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

function checkCellLength(json) {
  if (json.length > MAX_CELL_LENGTH) {
    throw new Error("Result is " + json.length + " characters, but a Sheets cell holds at most " +
      MAX_CELL_LENGTH + ". Split the data across several cells.");
  }
  return json;
}
