// The cases from the original test spreadsheet, one block per tab.
// Ranges are passed the way Sheets passes them to a custom function:
// a 2D array of rows, numbers as numbers, checkboxes as booleans.
const test = require('node:test');
const assert = require('node:assert');
const { ToJSON, ToJSONList } = require('./load').load();

test('v1: flat objects', () => {
  assert.strictEqual(ToJSON([['min', 'max']], [[0, 0]]), '{"min":0,"max":0}');
  assert.strictEqual(ToJSON([['min', 'max']], [[3, 'y']]), '{"min":3,"max":"y"}');
  assert.strictEqual(ToJSON('rewards', 1), '{"rewards":1}');
  assert.strictEqual(ToJSON('gold', '{"min":0,"max":0}'), '{"gold":{"min":0,"max":0}}');
  assert.strictEqual(
    ToJSON([['rewards', 'gold', 'squadcoins']], [[1, 2, ToJSON([['min', 'max']], [[0, 0]])]]),
    '{"rewards":1,"gold":2,"squadcoins":{"min":0,"max":0}}'
  );
  assert.strictEqual(ToJSON([["2'", '"0"']], [[5, 6]]), '{"2\'":5,"\\"0\\"":6}');
});

test('v2: dotted headers build nested objects', () => {
  assert.strictEqual(
    ToJSON(
      [['squadcoins.type', 'rewards', 'gold', 'squadcoins.min.x', 'squadcoins.min.y', 'squadcoins.max']],
      [['Plastic', 1, 2, 3, 6, 4]]
    ),
    '{"squadcoins":{"type":"Plastic","min":{"x":3,"y":6},"max":4},"rewards":1,"gold":2}'
  );
});

test('v3: lists', () => {
  assert.strictEqual(ToJSONList('a'), '["a"]');
  assert.strictEqual(ToJSONList('a', 'b', 3), '["a","b",3]');
  assert.strictEqual(ToJSONList([['a', 'b', 3]]), '["a","b",3]');
  assert.strictEqual(ToJSONList('a', [['a', 'b', 3]], 3, 3, [['b', 3]]), '["a","a","b",3,3,3,"b",3]');
  assert.strictEqual(
    ToJSONList([['{"a":1,"b":"michi"}', 'a', '["a",3,"b"]']]),
    '[{"a":1,"b":"michi"},"a",["a",3,"b"]]'
  );
  assert.strictEqual(ToJSONList(), '[]');
});

test('final1.1: list of row objects', () => {
  const headers = [['_rarity', '_weight']];
  const rows = [['Common', 160], ['Rare', 650], ['Epic', 160], ['Legendary', 30]];
  const expected =
    '[{"_rarity":"Common","_weight":160},{"_rarity":"Rare","_weight":650},' +
    '{"_rarity":"Epic","_weight":160},{"_rarity":"Legendary","_weight":30}]';
  assert.strictEqual(ToJSONList(rows.map(r => [ToJSON(headers, [r])])), expected);
});

const REWARDS = [
  ToJSON(
    [['value._tileNodeTypeData', 'value._canBecomeFloating', 'value._alwaysSpawnAsFloating', 'type']],
    [['kingChestM', false, true, 'TileNodeReward']]
  ),
  ToJSON(
    [['value.Value.Amount', 'value.Value.Currency', 'value.OperationBehaviour', 'type']],
    [[50000, 'g', 'AllowOverflow', 'CurrencyReward']]
  ),
  ToJSON(
    [['value.Value.Amount', 'value.Value.Currency', 'value.OperationBehaviour', 'type']],
    [[60000, 'r', 'AllowOverflow', 'CurrencyReward']]
  ),
  ToJSON(
    [['value.Reference', 'value.Amount', 'value.Mode', 'type']],
    [['pvp-nrg', 8, 'CapNormalAndOverflowAsBonus', 'EnergyReward']]
  ),
];
const REWARDS_JSON =
  '[{"value":{"_tileNodeTypeData":"kingChestM","_canBecomeFloating":false,"_alwaysSpawnAsFloating":true},"type":"TileNodeReward"},' +
  '{"value":{"Value":{"Amount":50000,"Currency":"g"},"OperationBehaviour":"AllowOverflow"},"type":"CurrencyReward"},' +
  '{"value":{"Value":{"Amount":60000,"Currency":"r"},"OperationBehaviour":"AllowOverflow"},"type":"CurrencyReward"},' +
  '{"value":{"Reference":"pvp-nrg","Amount":8,"Mode":"CapNormalAndOverflowAsBonus"},"type":"EnergyReward"}]';

test('final1.2: pack reward', () => {
  assert.strictEqual(
    ToJSON([['value.Rewards', 'type']], [[ToJSONList(REWARDS), 'PackReward']]),
    '{"value":{"Rewards":' + REWARDS_JSON + '},"type":"PackReward"}'
  );
});

test('Derulo Test3: mixed list', () => {
  assert.strictEqual(
    ToJSONList(7, ToJSON([['a', 'b']], [[1, 'michi']]), 'a', ToJSONList('a', 3, 'b')),
    '[7,{"a":1,"b":"michi"},"a",["a",3,"b"]]'
  );
});

test('Derulo Test4: nested list inside nested object', () => {
  assert.strictEqual(
    ToJSON([['value.pp', 'value.Rewards', 'value.pinaco', 'type']], [[7, ToJSONList(REWARDS), 5, 'PackReward']]),
    '{"value":{"pp":7,"Rewards":' + REWARDS_JSON + ',"pinaco":5},"type":"PackReward"}'
  );
});

test('Derulo Test5: lists of lists', () => {
  const k2 = ToJSON(
    [['a', 'b', 'v1', 'p', 'v2']],
    [[1, 'michi', ToJSONList(1, ToJSONList(1.2, 1.5)), 'p', ToJSONList(1, 2)]]
  );
  assert.strictEqual(
    ToJSONList(ToJSONList(7, 3, 1), k2, 'a', ToJSONList('a', 3, 'b')),
    '[[7,3,1],{"a":1,"b":"michi","v1":[1,[1.2,1.5]],"p":"p","v2":[1,2]},"a",["a",3,"b"]]'
  );
});

test('ImportedJSON (1): a quoted cell is a string, not a string with quotes', () => {
  assert.strictEqual(ToJSON([['a', 'b']], [['"1"', 'michi']]), '{"a":"1","b":"michi"}');
});

test('ImportedJSON (5): spawn pool config', () => {
  const pool = ToJSONList(ToJSON([['SquadId', 'Chance']], [['pillarwingedsunSquad', 1]]));
  assert.strictEqual(
    ToJSON(
      [[
        'lastJudgementCancelledDefenseReduction_duration', 'lastJudgementCancelledDefenseReduction_amount',
        'lastJudgement_area_radius', 'lastJudgement_damage_percentage', 'lastJudgement_cooldown',
        'lastJudgementSpawnPool.value._value', 'lastJudgementSpawnPool.type',
      ]],
      [[5, 0.2, 10, 4, 30, pool, 'SpawnUnitDataListConfigurableValueConfig']]
    ),
    '{"lastJudgementCancelledDefenseReduction_duration":5,"lastJudgementCancelledDefenseReduction_amount":0.2,' +
      '"lastJudgement_area_radius":10,"lastJudgement_damage_percentage":4,"lastJudgement_cooldown":30,' +
      '"lastJudgementSpawnPool":{"value":{"_value":[{"SquadId":"pillarwingedsunSquad","Chance":1}]},' +
      '"type":"SpawnUnitDataListConfigurableValueConfig"}}'
  );
});
