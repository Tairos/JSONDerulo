/**
 * Creates a JSON value based on ranges of property names and values.
 * With one row of values it returns an object; with several rows it returns
 * a list with one object per row (empty rows are skipped).
 * Can also take a single range whose first row holds the property names.
 *
 * @param {A1:Z1} propertiesRange Range of values to be used as property names.
 * @param {A2:Z2} valuesRange Range of values to be used as property values.
 * @returns JSON string.
 * @customfunction
*/
function ToJSON(propertiesRange, valuesRange) {
  if (valuesRange === undefined) {
    if (!Array.isArray(propertiesRange) || propertiesRange.length < 2) {
      throw new Error("Pass a range with property names in the first row and values below, or two ranges");
    }
    valuesRange = propertiesRange.slice(1);
    propertiesRange = [propertiesRange[0]];
  }

  var propertyList = toPropertyList(propertiesRange);
  var properties = propertyList.properties;
  var rows = toValueRows(valuesRange, propertyList);

  for (var i = 0; i < rows.length; i++) {
    if (rows[i].length != properties.length) {
      throw new Error("Properties and Values are not the same length");
    }
  }

  if (rows.length == 1) {
    return checkCellLength(JSON.stringify(parseToObject(properties, rows[0])));
  }

  var result = rows
    .filter(row => !row.every(isEmptyCell))
    .map(row => parseToObject(properties, row));

  return checkCellLength(JSON.stringify(result));
}

/**
* Creates a JSON list value based on parameters passed. Empty cells are
* skipped; write "" in a cell to add an empty string.
* @param {any[]} params Range of values and/or values
* @returns JSON string.
* @customfunction
*/
function ToJSONList(...params) {
  var values = params.flat(Infinity).filter(value => {
    return !isEmptyCell(value) && !(typeof value === 'number' && Number.isNaN(value));
  });

  return checkCellLength(JSON.stringify(values.map(value => parseValue(value))));
}
