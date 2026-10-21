// The cases from the original test spreadsheet, one block per tab.
// Ranges are passed the way Sheets passes them to a custom function:
// a 2D array of rows, numbers as numbers, checkboxes as booleans.
const test = require('node:test');
const assert = require('node:assert');
const { ToJSON, ToJSONList } = require('./load').load();

test('v1: flat objects', () => {
  assert.strictEqual(ToJSON([['min', 'max']], [[0, 0]]), '{"min":0,"max":0}');
  assert.strictEqual(ToJSON([['min', 'max']], [[3, 'y']]), '{"min":3,"max":"y"}');
  assert.strictEqual(ToJSON('stock', 1), '{"stock":1}');
  assert.strictEqual(ToJSON('price', '{"min":0,"max":0}'), '{"price":{"min":0,"max":0}}');
  assert.strictEqual(
    ToJSON([['stock', 'price', 'box']], [[1, 2, ToJSON([['min', 'max']], [[0, 0]])]]),
    '{"stock":1,"price":2,"box":{"min":0,"max":0}}'
  );
  // A header in quotes is a literal key, so "0" is the key 0 (this used to keep the quotes).
  assert.strictEqual(ToJSON([["2'", '"0"']], [[5, 6]]), '{"0":6,"2\'":5}');
});

test('v2: dotted headers build nested objects', () => {
  assert.strictEqual(
    ToJSON(
      [['box.type', 'stock', 'price', 'box.min.x', 'box.min.y', 'box.max']],
      [['Plastic', 1, 2, 3, 6, 4]]
    ),
    '{"box":{"type":"Plastic","min":{"x":3,"y":6},"max":4},"stock":1,"price":2}'
  );
});

test('v3: lists', () => {
  assert.strictEqual(ToJSONList('a'), '["a"]');
  assert.strictEqual(ToJSONList('a', 'b', 3), '["a","b",3]');
  assert.strictEqual(ToJSONList([['a', 'b', 3]]), '["a","b",3]');
  assert.strictEqual(ToJSONList('a', [['a', 'b', 3]], 3, 3, [['b', 3]]), '["a","a","b",3,3,3,"b",3]');
  assert.strictEqual(
    ToJSONList([['{"a":1,"b":"hello"}', 'a', '["a",3,"b"]']]),
    '[{"a":1,"b":"hello"},"a",["a",3,"b"]]'
  );
  assert.strictEqual(ToJSONList(), '[]');
});

test('final1.1: list of row objects', () => {
  const headers = [['_size', '_weight']];
  const rows = [['Small', 160], ['Medium', 650], ['Large', 160], ['Huge', 30]];
  const expected =
    '[{"_size":"Small","_weight":160},{"_size":"Medium","_weight":650},' +
    '{"_size":"Large","_weight":160},{"_size":"Huge","_weight":30}]';
  assert.strictEqual(ToJSONList(rows.map(r => [ToJSON(headers, [r])])), expected);
});

const ITEMS = [
  ToJSON(
    [['value._sku', 'value._isFragile', 'value._giftWrap', 'type']],
    [['chair-m', false, true, 'FurnitureItem']]
  ),
  ToJSON(
    [['value.Value.Amount', 'value.Value.Currency', 'value.Rounding', 'type']],
    [[50000, 'g', 'RoundUp', 'GiftCard']]
  ),
  ToJSON(
    [['value.Value.Amount', 'value.Value.Currency', 'value.Rounding', 'type']],
    [[60000, 'r', 'RoundUp', 'GiftCard']]
  ),
  ToJSON(
    [['value.Reference', 'value.Amount', 'value.Mode', 'type']],
    [['coupon-8', 8, 'PercentOff', 'Discount']]
  ),
];
const ITEMS_JSON =
  '[{"value":{"_sku":"chair-m","_isFragile":false,"_giftWrap":true},"type":"FurnitureItem"},' +
  '{"value":{"Value":{"Amount":50000,"Currency":"g"},"Rounding":"RoundUp"},"type":"GiftCard"},' +
  '{"value":{"Value":{"Amount":60000,"Currency":"r"},"Rounding":"RoundUp"},"type":"GiftCard"},' +
  '{"value":{"Reference":"coupon-8","Amount":8,"Mode":"PercentOff"},"type":"Discount"}]';

test('final1.2: bundle', () => {
  assert.strictEqual(
    ToJSON([['value.Items', 'type']], [[ToJSONList(ITEMS), 'Bundle']]),
    '{"value":{"Items":' + ITEMS_JSON + '},"type":"Bundle"}'
  );
});

test('Derulo Test3: mixed list', () => {
  assert.strictEqual(
    ToJSONList(7, ToJSON([['a', 'b']], [[1, 'hello']]), 'a', ToJSONList('a', 3, 'b')),
    '[7,{"a":1,"b":"hello"},"a",["a",3,"b"]]'
  );
});

test('Derulo Test4: nested list inside nested object', () => {
  assert.strictEqual(
    ToJSON([['value.id', 'value.Items', 'value.count', 'type']], [[7, ToJSONList(ITEMS), 5, 'Bundle']]),
    '{"value":{"id":7,"Items":' + ITEMS_JSON + ',"count":5},"type":"Bundle"}'
  );
});

test('Derulo Test5: lists of lists', () => {
  const k2 = ToJSON(
    [['a', 'b', 'v1', 'p', 'v2']],
    [[1, 'hello', ToJSONList(1, ToJSONList(1.2, 1.5)), 'p', ToJSONList(1, 2)]]
  );
  assert.strictEqual(
    ToJSONList(ToJSONList(7, 3, 1), k2, 'a', ToJSONList('a', 3, 'b')),
    '[[7,3,1],{"a":1,"b":"hello","v1":[1,[1.2,1.5]],"p":"p","v2":[1,2]},"a",["a",3,"b"]]'
  );
});

test('ImportedJSON (1): a quoted cell is a string, not a string with quotes', () => {
  assert.strictEqual(ToJSON([['a', 'b']], [['"1"', 'hello']]), '{"a":"1","b":"hello"}');
});

test('ImportedJSON (5): spawn pool config', () => {
  const pool = ToJSONList(ToJSON([['Host', 'Weight']], [['eu-west', 1]]));
  assert.strictEqual(
    ToJSON(
      [[
        'retry_delay', 'retry_backoff',
        'timeout', 'max_retries', 'cache_ttl',
        'servers.value._value', 'servers.type',
      ]],
      [[5, 0.2, 10, 4, 30, pool, 'ServerListConfig']]
    ),
    '{"retry_delay":5,"retry_backoff":0.2,' +
      '"timeout":10,"max_retries":4,"cache_ttl":30,' +
      '"servers":{"value":{"_value":[{"Host":"eu-west","Weight":1}]},' +
      '"type":"ServerListConfig"}}'
  );
});
