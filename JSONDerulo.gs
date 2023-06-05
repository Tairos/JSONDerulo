/**
 * Creates a JSON value based on ranges of property names and values.
 * 
 * @param {A1:Z1} propertiesRange Range of values to be used as property names.
 * @param {A1:Z1} valuesRange Range of values to be used as property values.
 * @returns JSON string.
 * @customfunction
*/
function JSONISE(propertiesRange, valuesRange) {
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

function validateProperties(properties)
{
    for (var i = 0; i < properties.length; i++) {
      if (typeof properties[i] !== 'string' && !(properties[i] instanceof String))
      {
        throw new Error("One of the properties is not a string");
      }
    }
}

//Logger.log(JSONISE("min",0));
//Logger.log(JSONISE([["min", "max"]],[[0,0]]));
//Logger.log(JSONISE([["rewards", "gold", "squadcoins.min.x","squadcoins.min.y", "squadcoins.max"]],[[0,1,2,3,4]]));
