const test = require('node:test');
const assert = require('node:assert');
const ctx = require('./load').load();
const { simulate, fillDown } = require('./sheet-sim');

// Arrays made inside the vm context have another prototype; compare plain copies.
const plain = value => JSON.parse(JSON.stringify(value));

// Imports the JSON, evaluates the sheet and checks it gives back the same JSON,
// with both formula argument separators.
function roundTrip(json) {
  for (const separator of [';', ',']) {
    const layout = ctx.layoutJSON(json, separator);
    assert.strictEqual(simulate(ctx, layout).value(3, 1), JSON.stringify(json));
  }
  return ctx.layoutJSON(json, ',');
}

const SHEET_JSONS = {
  'Derulo Test1': '{"box":{"type":"Plastic","min":{"x":3,"y":6},"max":4},"stock":1,"price":2}',
  'Derulo Test2': '[{"_size":"Small","_weight":160},{"_size":"Medium","_weight":650},{"_size":"Large","_weight":160},{"_size":"Huge","_weight":30}]',
  'Derulo Test3': '[7,{"a":1,"b":"hello"},"a",["a",3,"b"]]',
  'Derulo Test4': '{"value":{"id":7,"Items":[{"value":{"_sku":"chair-m","_isFragile":false,"_giftWrap":true},"type":"FurnitureItem"},{"value":{"Value":{"Amount":50000,"Currency":"g"},"Rounding":"RoundUp"},"type":"GiftCard"},{"value":{"Value":{"Amount":60000,"Currency":"r"},"Rounding":"RoundUp"},"type":"GiftCard"},{"value":{"Reference":"coupon-8","Amount":8,"Mode":"PercentOff"},"type":"Discount"}],"count":5},"type":"Bundle"}',
  'Derulo Test5': '[[7,3,1],{"a":1,"b":"hello","v1":[1,[1.2,1.5]],"p":"p","v2":[1,2]},"a",["a",3,"b"]]',
  'ImportedJSON (1)': '{"a":"1","b":"hello"}',
  'ImportedJSON (5)': '{"retry_delay":5,"retry_backoff":0.2,"timeout":10,"max_retries":4,"cache_ttl":30,"servers":{"value":{"_value":[{"Host":"eu-west","Weight":1}]},"type":"ServerListConfig"}}',
};

for (const [name, json] of Object.entries(SHEET_JSONS)) {
  test('round trip: ' + name, () => roundTrip(JSON.parse(json)));
}

test('an object is one row of values under its headers', () => {
  const layout = roundTrip({ a: 1, b: 'hello' });
  assert.deepStrictEqual(plain(layout.values), [['', '', ''], ['JSON', 'a', 'b'], ['=ToJSON(B$2:C$2, B3:C3)', 1, 'hello']]);
});

test('the separator comes from the caller', () => {
  assert.strictEqual(ctx.layoutJSON({ a: 1 }, ';').values[2][0], '=ToJSON(B$2:B$2; B3:B3)');
});

test('lists go sideways, and nested blocks come after an empty column with a title', () => {
  const layout = roundTrip({ value: { Items: [{ a: 1 }, 'x'] } });
  assert.deepStrictEqual(plain(layout.values), [
    ['', '', '', '↳ value.Items', '', '', '↳ value.Items[0]'],
    ['JSON', 'value.Items', '', '[0]', '[1]', '', 'a'],
    ['=ToJSON(B$2:B$2, B3:B3)', '=ToJSONList(D3:E3)', '', '=ToJSON(G$2:G$2, G3:G3)', 'x', '', 1],
  ]);
});

test('awkward keys keep their quotes in titles', () => {
  const layout = roundTrip({ 'key.with.dots': { kept: 'yes' } });
  assert.deepStrictEqual(plain(layout.values), [
    ['', '', '', '↳ "key.with.dots"'],
    ['JSON', '"key.with.dots"', '', 'kept'],
    ['=ToJSON(B$2:B$2, B3:B3)', '=ToJSON(D$2:D$2, D3:D3)', '', 'yes'],
  ]);
});

test('every JSON fits on row 3, whatever its shape', () => {
  for (const json of Object.values(SHEET_JSONS).map(j => JSON.parse(j))) {
    assert.strictEqual(ctx.layoutJSON(json).rows, 3);
  }
});

test('dragging row 3 down makes another JSON with the same structure', () => {
  const layout = ctx.layoutJSON({ name: 'chair', price: 40, tags: ['wood', 'new'], size: { w: 1, h: 2 } });
  assert.deepStrictEqual(plain(layout.values[1]), ['JSON', 'name', 'price', 'tags', 'size.w', 'size.h', '', '[0]', '[1]']);
  const filled = fillDown(layout, 4, { B: 'lamp', C: 15, H: 'metal', I: '', E: 3 });
  const sheet = simulate(ctx, filled);
  assert.strictEqual(sheet.value(3, 1), '{"name":"chair","price":40,"tags":["wood","new"],"size":{"w":1,"h":2}}');
  // An emptied list cell makes that row's list shorter.
  assert.strictEqual(sheet.value(4, 1), '{"name":"lamp","price":15,"tags":["metal"],"size":{"w":3,"h":2}}');
});

test('dragging down works for nested lists of objects too', () => {
  const json = JSON.parse(SHEET_JSONS['Derulo Test4']);
  const layout = ctx.layoutJSON(json, ';');
  const filled = fillDown(fillDown(layout, 4), 5);
  const sheet = simulate(ctx, filled);
  assert.strictEqual(sheet.value(4, 1), JSON.stringify(json));
  assert.strictEqual(sheet.value(5, 1), JSON.stringify(json));
});

test('formula separator follows the spreadsheet locale', () => {
  const separators = ['en_US', 'en_GB', 'es_ES', 'es_MX', 'pt_BR', 'de_DE', 'de_CH', 'fr_FR', 'ja_JP', 'xx_YY', '']
    .map(locale => locale + ' ' + ctx.formulaSeparator(locale));
  assert.deepStrictEqual(plain(separators), [
    'en_US ,', 'en_GB ,', 'es_ES ;', 'es_MX ,', 'pt_BR ;', 'de_DE ;', 'de_CH ,', 'fr_FR ;', 'ja_JP ,', 'xx_YY ,', ' ,',
  ]);
});

test('strings that would read back as something else', () => {
  roundTrip({
    numeric: '1', decimal: '0.5', exp: '1e5', spaces: ' 12 ', negative: '-3',
    bool: 'true', BOOL: 'FALSE', nullText: 'null', empty: '',
    formula: '=SUM(A1)', apostrophe: "'quoted", quoted: '"q"',
    objectText: '{"a":1}', listText: '[1,2]', notJSON: '{player}', spacedJSON: ' [1] ',
    date: '2024-01-01', percent: '50%', newline: 'a\nb', unicode: 'ñandú 🐦',
  });
});

test('null, booleans and numbers', () => {
  roundTrip({ n: null, t: true, f: false, zero: 0, neg: -1.5, big: 1e21, list: [null, false, 0, ''] });
});

test('empty objects and lists', () => {
  roundTrip({ o: {}, l: [], nested: { o: {} }, list: [{}, []] });
  roundTrip([]);
  roundTrip({});
});

test('property names that cannot be headers are kept as JSON text', () => {
  roundTrip({ 'a.b': 1, c: 2 });
  roundTrip({ x: { 'a.b': 1 }, y: { '': 2 }, z: { '=x': 3, "'y": 4 } });
  roundTrip({ '2020': 1, '007': 2, '1.5': 3, __proto__x: 4 });
});

test('__proto__ as a property name', () => {
  roundTrip(JSON.parse('{"__proto__":{"x":1},"a":2}'));
});

test('lists of lists and single-item lists', () => {
  roundTrip([[[1]], [[]], [[2, [3]]]]);
  roundTrip({ one: [{ a: 1 }], two: [[1]] });
});

test('lists of objects with the same or different properties', () => {
  roundTrip([{ a: 1, b: 2 }, { b: 2, a: 1 }]);
  roundTrip([{ a: 1 }, { a: 1, b: 2 }]);
  roundTrip([{ a: { x: 1 } }, { a: { x: 2 } }]);
  roundTrip([{ a: [1] }, { a: [2] }]);
  roundTrip([{ a: '' }, { a: '' }]);
});

test('root values that are not objects or lists', () => {
  for (const json of [5, 'text', '1', true, null]) {
    const layout = ctx.layoutJSON(json);
    assert.strictEqual(layout.values[2][0], JSON.stringify(json));
  }
});

test('big JSON: very long lists need more columns than a sheet has', () => {
  const rows = Array.from({ length: 5000 }, (_, i) => ({ id: 'item_' + i, weight: i, meta: { tier: i % 5, tag: 'x' + i } }));
  const layout = ctx.layoutJSON(rows);
  assert.strictEqual(layout.rows, 3);
  assert.ok(layout.columns > 18278, 'columns: ' + layout.columns);
});

test('big JSON: 300 mixed items', () => {
  const kinds = [
    i => ({ value: { _sku: 'chair' + i, _isFragile: i % 2 == 0 }, type: 'FurnitureItem' }),
    i => ({ value: { Value: { Amount: i * 100, Currency: 'g' } }, type: 'GiftCard' }),
    i => ({ value: { Reference: 'coupon', Amount: i, Tags: ['a', String(i)] }, type: 'Discount' }),
  ];
  roundTrip({ value: { Items: Array.from({ length: 300 }, (_, i) => kinds[i % 3](i)) }, type: 'Bundle' });
});

test('column letters', () => {
  assert.deepStrictEqual([1, 26, 27, 52, 703, 18278].map(n => ctx.columnA1(n)), ['A', 'Z', 'AA', 'AZ', 'AAA', 'ZZZ']);
});

test('every file in examples/ round trips', () => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', 'examples');
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (file.includes('too-big')) {
      assert.throws(() => simulate(ctx, ctx.layoutJSON(json)).value(3, 1), /holds at most 50000/, file);
    } else {
      roundTrip(json);
    }
  }
});

test('awkward property names get quoted headers instead of collapsing the object', () => {
  const layout = roundTrip({ 'key.with.dots': 1, plain: 2, '': 3, '"q"': 4, nested: { 'a.b': { c: 5 } } });
  assert.deepStrictEqual(plain(layout.values[1]).slice(0, 6), ['JSON', '"key.with.dots"', 'plain', '""', '"\\"q\\""', 'nested']);
});
