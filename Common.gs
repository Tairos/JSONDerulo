function isString(value) {
  return (typeof value === 'string' || value instanceof String);
}

function isStringJSONObject(value) {
  return isString(value) && value.startsWith("{") && value.endsWith("}");
}


function isStringJSONArray(value) {
  return isString(value) && value.startsWith("[") && value.endsWith("]");
}
