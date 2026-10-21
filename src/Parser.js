// Turns a range (or single cell) of property names into a flat list.
// Accepts one row or one column.
function toPropertyList(propertiesRange) {
  if (!Array.isArray(propertiesRange)) {
    return { properties: [propertiesRange], isColumn: false };
  }

  if (propertiesRange.length == 1) {
    return { properties: propertiesRange[0], isColumn: false };
  }

  if (propertiesRange.every(row => Array.isArray(row) && row.length == 1)) {
    return { properties: propertiesRange.map(row => row[0]), isColumn: true };
  }

  throw new Error("Properties must be a single row or a single column");
}

// Turns a range (or single cell) of values into rows that line up with the properties.
function toValueRows(valuesRange, propertyList) {
  if (!Array.isArray(valuesRange)) {
    return [[valuesRange]];
  }

  var isColumn = valuesRange.length > 1 && valuesRange.every(row => row.length == 1);
  if (propertyList.isColumn && isColumn) {
    return [valuesRange.map(row => row[0])];
  }

  return valuesRange;
}

function propertyName(property, column) {
  if (isString(property)) {
    return String(property);
  }

  if (typeof property === 'number' && Number.isFinite(property)) {
    return String(property);
  }

  throw new Error("Property in column " + column + " is not text or a number");
}

function parseToObject(properties, values) {
  var result = {};

  for (var i = 0; i < properties.length; i++) {
    if (isEmptyCell(properties[i])) {
      if (!isEmptyCell(values[i])) {
        throw new Error("Column " + (i + 1) + " has a value but no property name");
      }
      continue;
    }

    var name = propertyName(properties[i], i + 1);
    // Only text is split on dots: a number like 1.5 is a single key.
    var keys = isString(properties[i]) ? name.split(".") : [name];
    if (keys.some(key => key.length == 0)) {
      throw new Error('Property "' + name + '" has an empty part');
    }

    parseInObject(result, keys, parseValue(values[i]), name);
  }

  return result;
}

function parseInObject(object, keys, value, name) {
  var curr = object;
  for (var i = 0; i < keys.length - 1; i++) {
    if (!hasKey(curr, keys[i])) {
      setKey(curr, keys[i], {});
    }
    else if (!isObject(curr[keys[i]])) {
      throw new Error('Property "' + name + '" needs "' + keys.slice(0, i + 1).join(".") +
        '" to be an object, but it already has a value');
    }

    curr = curr[keys[i]];
  }

  var last = keys[keys.length - 1];
  if (!hasKey(curr, last)) {
    setKey(curr, last, value);
    return;
  }

  // "a.x" followed by "a" = {"y":1} (or the other way round) merges both.
  if (isObject(curr[last]) && isObject(value)) {
    mergeInto(curr[last], value, name);
    return;
  }

  throw new Error('Property "' + name + '" is set more than once');
}

function mergeInto(target, source, path) {
  for (var key of Object.keys(source)) {
    if (!hasKey(target, key)) {
      setKey(target, key, source[key]);
    }
    else if (isObject(target[key]) && isObject(source[key])) {
      mergeInto(target[key], source[key], path + "." + key);
    }
    else {
      throw new Error('Property "' + path + "." + key + '" is set more than once');
    }
  }
}

// Cells holding JSON (an object, an array or a "quoted string") become that
// JSON value, and the text null becomes null. Anything that fails to parse
// stays as plain text.
function parseValue(value) {
  if (isDate(value)) {
    return formatDate(value);
  }

  if (!isString(value)) {
    return value;
  }

  if (value == "null") {
    return null;
  }

  var trimmed = value.trim();
  if (isStringJSONObject(trimmed) || isStringJSONArray(trimmed) || isStringJSONString(trimmed)) {
    try {
      return JSON.parse(trimmed);
    }
    catch (e) {
      return value;
    }
  }

  return value;
}
