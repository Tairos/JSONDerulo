function parseToObject(headers, values)
{
  var result = new Object;
  if (!Array.isArray(headers))
  {
    result[headers] = parseValue(values);
    return result;
  }

  for (var i = 0; i < headers.length; i++) {
    var headerSplit = headers[i].split(".");
    if (headerSplit.length > 1)
    {
      parseInObject(result, headerSplit, values[i]);
      continue;
    }

    result[headers[i]] = parseValue(values[i]);
  }

  return result;
}

function parseInObject(object, keys, value)
{
  var curr = object;
  for (var i = 0; i < keys.length; i++)
  {
    if (i == keys.length-1)
    {
      curr[keys[i]] = parseValue(value)
      return;
    }

    if (!curr.hasOwnProperty(keys[i]))
    {
      curr[keys[i]] = new Object;
    }

    curr = curr[keys[i]];
  }
}

function parseValue(value)
{

  if (isStringJSONObject(value) || isStringJSONArray(value))
  {
      return JSON.parse(value);
  }

  return value;
}


//Logger.log(JSON.stringify(parseToObject(["rewards", "gold", "squadcoins.min.x","squadcoins.min.y", "squadcoins.max"],[0,1,2,3,4])));
