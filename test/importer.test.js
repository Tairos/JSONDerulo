const test = require('node:test');
const assert = require('node:assert');
const ctx = require('./load').load();
const { simulate } = require('./sheet-sim');

// Arrays made inside the vm context have another prototype; compare plain copies.
const plain = value => JSON.parse(JSON.stringify(value));

// Imports the JSON, evaluates the sheet and checks it gives back the same JSON.
function roundTrip(json) {
  const layout = ctx.layoutJSON(json);
  const result = simulate(ctx, layout).value(2, 1);
  assert.strictEqual(result, JSON.stringify(json));
  return layout;
}

const SHEET_JSONS = {
  'Derulo Test1': '{"squadcoins":{"type":"Plastic","min":{"x":3,"y":6},"max":4},"rewards":1,"gold":2}',
  'Derulo Test2': '[{"_rarity":"Common","_weight":160},{"_rarity":"Rare","_weight":650},{"_rarity":"Epic","_weight":160},{"_rarity":"Legendary","_weight":30}]',
  'Derulo Test3': '[7,{"a":1,"b":"michi"},"a",["a",3,"b"]]',
  'Derulo Test4': '{"value":{"pp":7,"Rewards":[{"value":{"_tileNodeTypeData":"kingChestM","_canBecomeFloating":false,"_alwaysSpawnAsFloating":true},"type":"TileNodeReward"},{"value":{"Value":{"Amount":50000,"Currency":"g"},"OperationBehaviour":"AllowOverflow"},"type":"CurrencyReward"},{"value":{"Value":{"Amount":60000,"Currency":"r"},"OperationBehaviour":"AllowOverflow"},"type":"CurrencyReward"},{"value":{"Reference":"pvp-nrg","Amount":8,"Mode":"CapNormalAndOverflowAsBonus"},"type":"EnergyReward"}],"pinaco":5},"type":"PackReward"}',
  'Derulo Test5': '[[7,3,1],{"a":1,"b":"michi","v1":[1,[1.2,1.5]],"p":"p","v2":[1,2]},"a",["a",3,"b"]]',
  'ImportedJSON (1)': '{"a":"1","b":"michi"}',
  'ImportedJSON (5)': '{"lastJudgementCancelledDefenseReduction_duration":5,"lastJudgementCancelledDefenseReduction_amount":0.2,"lastJudgement_area_radius":10,"lastJudgement_damage_percentage":4,"lastJudgement_cooldown":30,"lastJudgementSpawnPool":{"value":{"_value":[{"SquadId":"pillarwingedsunSquad","Chance":1}]},"type":"SpawnUnitDataListConfigurableValueConfig"}}',
};

for (const [name, json] of Object.entries(SHEET_JSONS)) {
  test('round trip: ' + name, () => roundTrip(JSON.parse(json)));
}

test('layout of a simple object matches the original sheets', () => {
  const layout = roundTrip({ a: 1, b: 'michi' });
  assert.deepStrictEqual(plain(layout.values), [['JSON', 'a', 'b'], ['=ToJSON(B1:C2)', 1, 'michi']]);
});

test('a list of objects with the same properties becomes a table', () => {
  const layout = roundTrip(JSON.parse(SHEET_JSONS['Derulo Test2']));
  assert.deepStrictEqual(plain(layout.values), [
    ['JSON', '_rarity', '_weight'],
    ['=ToJSON(B1:C5)', 'Common', 160],
    ['', 'Rare', 650],
    ['', 'Epic', 160],
    ['', 'Legendary', 30],
  ]);
});

test('nested blocks are labelled with their path', () => {
  const layout = roundTrip({ value: { Rewards: [{ a: 1 }, 'x'] } });
  assert.deepStrictEqual(plain(layout.values[0]), ['JSON', 'value.Rewards', 'value.Rewards', 'items', 'value.Rewards[0]', 'a']);
  assert.deepStrictEqual(plain(layout.values[1]), ['=ToJSON(B1:B2)', '=ToJSONList(D2:D3)', '', '=ToJSON(F1:F2)', '', 1]);
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

test('tables are only used when every object has the same properties', () => {
  roundTrip([{ a: 1, b: 2 }, { b: 2, a: 1 }]);
  roundTrip([{ a: 1 }, { a: 1, b: 2 }]);
  roundTrip([{ a: { x: 1 } }, { a: { x: 2 } }]);
  roundTrip([{ a: [1] }, { a: [2] }]);
  roundTrip([{ a: '' }, { a: '' }]);
});

test('root values that are not objects or lists', () => {
  for (const json of [5, 'text', '1', true, null]) {
    const layout = ctx.layoutJSON(json);
    assert.strictEqual(layout.values[1][0], JSON.stringify(json));
  }
});

test('big JSON: a 5000-row table stays narrow', () => {
  const rows = Array.from({ length: 5000 }, (_, i) => ({ id: 'item_' + i, weight: i, meta: { tier: i % 5, tag: 'x' + i } }));
  const layout = ctx.layoutJSON(rows);
  assert.strictEqual(layout.columns, 5);
  assert.strictEqual(layout.rows, 5001);
  // The result is over the cell limit, so the root formula says so.
  assert.throws(() => simulate(ctx, layout).value(2, 1), /holds at most 50000/);
});

test('big JSON: 300 mixed rewards', () => {
  const kinds = [
    i => ({ value: { _tileNodeTypeData: 'chest' + i, _canBecomeFloating: i % 2 == 0 }, type: 'TileNodeReward' }),
    i => ({ value: { Value: { Amount: i * 100, Currency: 'g' } }, type: 'CurrencyReward' }),
    i => ({ value: { Reference: 'nrg', Amount: i, Tags: ['a', String(i)] }, type: 'EnergyReward' }),
  ];
  roundTrip({ value: { Rewards: Array.from({ length: 300 }, (_, i) => kinds[i % 3](i)) }, type: 'PackReward' });
});

test('column letters', () => {
  assert.deepStrictEqual([1, 26, 27, 52, 703, 18278].map(n => ctx.columnA1(n)), ['A', 'Z', 'AA', 'AZ', 'AAA', 'ZZZ']);
});
