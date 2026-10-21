const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./load');
const { ToJSON, ToJSONList } = load();

test('a value and a nested property with the same name is an error, not data loss', () => {
  assert.throws(() => ToJSON([['a', 'a.b']], [[1, 2]]), /needs "a" to be an object/);
  assert.throws(() => ToJSON([['a.b', 'a']], [[1, 2]]), /"a" is set more than once/);
  assert.throws(() => ToJSON([['a', 'a']], [[1, 2]]), /"a" is set more than once/);
});

test('a JSON object cell merges with dotted properties under the same name', () => {
  assert.strictEqual(ToJSON([['a', 'a.y']], [['{"x":1}', 2]]), '{"a":{"x":1,"y":2}}');
  assert.strictEqual(ToJSON([['a.y', 'a']], [[2, '{"x":1}']]), '{"a":{"y":2,"x":1}}');
  assert.throws(() => ToJSON([['a', 'a.x']], [['{"x":1}', 2]]), /"a.x" is set more than once/);
});

test('empty property cells are skipped', () => {
  assert.strictEqual(ToJSON([['a', 'b', '', '']], [[1, 2, '', '']]), '{"a":1,"b":2}');
  assert.throws(() => ToJSON([['a', '']], [[1, 2]]), /Column 2 has a value but no property name/);
});

test('empty parts in a dotted property are an error', () => {
  assert.throws(() => ToJSON([['a..b']], [[1]]), /"a..b" has an empty part/);
  assert.throws(() => ToJSON([['.a']], [[1]]), /has an empty part/);
});

test('empty value cells stay empty strings', () => {
  assert.strictEqual(ToJSON([['a', 'b']], [[1, '']]), '{"a":1,"b":""}');
});

test('text that only looks like JSON stays text', () => {
  assert.strictEqual(ToJSON([['a']], [['{player}']]), '{"a":"{player}"}');
  assert.strictEqual(ToJSON([['a']], [['[x]']]), '{"a":"[x]"}');
  assert.strictEqual(ToJSON([['a']], [['"hi" and "bye"']]), '{"a":"\\"hi\\" and \\"bye\\""}');
});

test('JSON cells with surrounding spaces are parsed', () => {
  assert.strictEqual(ToJSON([['a']], [[' [1,2] ']]), '{"a":[1,2]}');
  assert.strictEqual(ToJSONList(' {"x":1}\n'), '[{"x":1}]');
});

test('quoted cells force a string', () => {
  assert.strictEqual(ToJSON([['id', 'flag']], [['"007"', '"true"']]), '{"id":"007","flag":"true"}');
  assert.strictEqual(ToJSONList([['a', '""', 'c']]), '["a","","c"]');
});

test('numbers can be property names', () => {
  // JavaScript always lists integer-like keys first.
  assert.strictEqual(ToJSON([['a', 2020]], [[1, 2]]), '{"2020":2,"a":1}');
  assert.strictEqual(ToJSON([[1.5]], [[1]]), '{"1.5":1}');
  assert.throws(() => ToJSON([['a', true]], [[1, 2]]), /column 2 is not text or a number/);
});

test('dates use the local date, not UTC', () => {
  assert.strictEqual(ToJSON([['d']], [[new Date(2024, 0, 1)]]), '{"d":"2024-01-01"}');
  assert.strictEqual(ToJSONList(new Date(2024, 0, 1, 9, 5, 3)), '["2024-01-01T09:05:03"]');
});

test('dates use the spreadsheet time zone in Apps Script', () => {
  const calls = [];
  const apps = load({
    SpreadsheetApp: { getActive: () => ({ getSpreadsheetTimeZone: () => 'Europe/Madrid' }) },
    Utilities: {
      formatDate(date, timeZone, format) {
        calls.push([timeZone, format]);
        return format === 'HH:mm:ss' ? '00:00:00' : '2024-01-01';
      },
    },
  });
  assert.strictEqual(apps.ToJSON('d', new Date(Date.UTC(2023, 11, 31, 23))), '{"d":"2024-01-01"}');
  assert.deepStrictEqual(calls, [['Europe/Madrid', 'HH:mm:ss'], ['Europe/Madrid', 'yyyy-MM-dd']]);
});

test('several rows of values give a list of objects', () => {
  assert.strictEqual(
    ToJSON([['_size', '_weight']], [['Small', 160], ['Medium', 650], ['', ''], ['Large', 160]]),
    '[{"_size":"Small","_weight":160},{"_size":"Medium","_weight":650},{"_size":"Large","_weight":160}]'
  );
  assert.strictEqual(ToJSON([['a']], [[1], ['']]), '[{"a":1}]');
});

test('properties and values can be columns', () => {
  assert.strictEqual(ToJSON([['a'], ['b.c']], [[1], [2]]), '{"a":1,"b":{"c":2}}');
  assert.strictEqual(ToJSON([['a'], ['b']], [[1, 2]]), '{"a":1,"b":2}');
  assert.throws(() => ToJSON([['a', 'b'], ['c', 'd']], [[1, 2]]), /single row or a single column/);
});

test('mismatched lengths are an error', () => {
  assert.throws(() => ToJSON('a', [[1, 2]]), /not the same length/);
  assert.throws(() => ToJSON([['a', 'b']], [[1, 2], [3]]), /not the same length/);
});

test('__proto__ is stored as a normal property', () => {
  assert.strictEqual(ToJSON([['__proto__.x']], [[1]]), '{"__proto__":{"x":1}}');
  assert.strictEqual(({}).x, undefined);
});

test('lists skip empty cells and keep false and 0', () => {
  assert.strictEqual(ToJSONList([['a', '', 'c']]), '["a","c"]');
  assert.strictEqual(ToJSONList([[true, false, 0, NaN]]), '[true,false,0]');
  let deep = 'deep';
  for (let i = 0; i < 20; i++) deep = [deep];
  assert.strictEqual(ToJSONList(deep), '["deep"]');
});

test('results over the 50,000 character cell limit give a clear error', () => {
  const big = 'x'.repeat(50000);
  assert.throws(() => ToJSONList(big), /Result is 50004 characters, but a Sheets cell holds at most 50000/);
  assert.throws(() => ToJSON('a', big), /holds at most 50000/);
});

test('a large list just under the limit works', () => {
  const items = Array.from({ length: 600 }, (_, i) =>
    [JSON.stringify({ id: 'item_' + i, weight: i, rarity: 'Huge', tags: ['a', 'b'] })]);
  const out = JSON.parse(ToJSONList(items));
  assert.strictEqual(out.length, 600);
  assert.deepStrictEqual(out[599], { id: 'item_599', weight: 599, rarity: 'Huge', tags: ['a', 'b'] });
});

test('a single range with property names in the first row', () => {
  assert.strictEqual(ToJSON([['a', 'b'], [1, 2]]), '{"a":1,"b":2}');
  assert.strictEqual(ToJSON([['a'], [1], [2]]), '[{"a":1},{"a":2}]');
  assert.throws(() => ToJSON([['a', 'b']]), /property names in the first row/);
  assert.throws(() => ToJSON('a'), /property names in the first row/);
});

test('the text null is null', () => {
  assert.strictEqual(ToJSON([['a', 'b']], [['null', '"null"']]), '{"a":null,"b":"null"}');
  assert.strictEqual(ToJSONList('null'), '[null]');
});

test('a header in quotes is one literal key', () => {
  assert.strictEqual(ToJSON([['"a.b"', 'c']], [[1, 2]]), '{"a.b":1,"c":2}');
  assert.strictEqual(ToJSON([['""']], [[1]]), '{"":1}');
  assert.strictEqual(ToJSON([['"\\"x\\""']], [[1]]), '{"\\"x\\"":1}');
  assert.strictEqual(ToJSON([['"a.b"', 'a']], [[1, 2]]), '{"a.b":1,"a":2}');
  assert.throws(() => ToJSON([['"a"', 'a']], [[1, 2]]), /set more than once/);
});
