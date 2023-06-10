/**
 * Creates a JSON value based on ranges of property names and values.
 * 
 * @param {A1:Z1} propertiesRange Range of values to be used as property names.
 * @param {A1:Z1} valuesRange Range of values to be used as property values.
 * @returns JSON string.
 * @customfunction
*/
function ToJSON(propertiesRange, valuesRange) {
  var properties = Array.isArray(propertiesRange)?propertiesRange[0]:propertiesRange;
  var values = Array.isArray(valuesRange)?valuesRange[0]:valuesRange;

  validateProperties(properties);
  if (Array.isArray(properties) && Array.isArray(values) && properties.length != values.length)
  {
      throw new Error("Properties and Values are not the same length");
  }

  var result = parseToObject(properties, values);

  return JSON.stringify(result);
}
//Logger.log(ToJSON("min",0));
//Logger.log(ToJSON([["min", "max"]],[[0,0]]));
//Logger.log(ToJSON([["rewards", "gold", "squadcoins.min.x","squadcoins.min.y", "squadcoins.max"]],[[0,1,2,3,4]]));

/**
* Creates a JSON list value based on parameters passed.
* @param {any[]} params Range of values and/or values
* @returns JSON string.
* @customfunction
*/
function ToJSONList(...params) {
  if (params.length == 0)
  {
    return "[]";
  }

  var flatParams = params.flat(9999);

  var finalArr = flatParams.filter(n => {
    return (!isString(n) && !Number.isNaN(n)) | (isString(n) && n.length > 0);
 } );

   return JSON.stringify(finalArr.map(v => parseValue(v)));
}
//Logger.log(ToJSONList("param1","param2","param3", 1,2,3));
//Logger.log(ToJSONList([[[0.9,0.5,""]]]));


function validateProperties(properties)
{
    for (var i = 0; i < properties.length; i++) {
      if (typeof properties[i] !== 'string' && !(properties[i] instanceof String))
      {
        throw new Error("One of the properties is not a string");
      }
    }
}

