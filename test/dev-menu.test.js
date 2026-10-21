// The dev menu must only ever appear in the developer's own spreadsheet, and
// opening the spreadsheet must never import anything by itself.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { load } = require('./load');

const root = path.join(__dirname, '..');

// A fake spreadsheet that records every change made to it.
function fakeSheets(scriptId) {
  const calls = [];
  const created = new Set();
  const spreadsheet = {
    getSheetByName: name => (created.has(name)
      ? { activate() {}, getRange: () => ({ getFormula: () => '', getValue: () => '' }) }
      : null),
    deleteSheet: () => calls.push('deleteSheet'),
    insertSheet: () => calls.push('insertSheet'),
    toast: () => calls.push('toast'),
  };
  const menu = name => {
    const m = { addItem: (label) => { calls.push(name + ': ' + label); return m; }, addSeparator: () => m, addToUi: () => {} };
    return m;
  };
  return {
    calls,
    created,
    globals: {
      SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, getUi: () => ({ createMenu: menu }) },
      ScriptApp: { getScriptId: () => scriptId },
    },
  };
}

test('src/ has no dev code: opening only adds the normal menu', () => {
  assert.ok(!fs.readdirSync(path.join(root, 'src')).some(f => /dev/i.test(f)));
  const sheets = fakeSheets('any-script');
  const ctx = load(sheets.globals);
  assert.strictEqual(typeof ctx.onOpenDev, 'undefined');
  ctx.onOpen();
  assert.deepStrictEqual(sheets.calls, ['JSONDerulo: Create sheet from JSON']);
});

test('the dev build adds its menu only in your script, and opening imports nothing', { skip: !fs.existsSync(path.join(root, '.clasp.json')) && 'needs .clasp.json' }, () => {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-dev.js')]);
  const dir = path.join(root, 'build', 'dev', 'src');
  const scriptId = JSON.parse(fs.readFileSync(path.join(root, '.clasp.json'), 'utf8')).scriptId;

  const open = id => {
    const sheets = fakeSheets(id);
    const ctx = vm.createContext({ Logger: { log() {} }, ...sheets.globals });
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
      vm.runInContext(fs.readFileSync(path.join(dir, file), 'utf8'), ctx);
    }
    ctx.createNewSheet = (json, name) => { sheets.created.add(name); sheets.calls.push('createNewSheet'); };
    ctx.addImportCheck = () => sheets.calls.push('addImportCheck');
    ctx.onOpen();
    return { ctx, sheets };
  };

  assert.deepStrictEqual(open('someone-elses-copy').sheets.calls, ['JSONDerulo: Create sheet from JSON']);

  const mine = open(scriptId);
  assert.deepStrictEqual(mine.sheets.calls, [
    'JSONDerulo: Create sheet from JSON',
    'JSONDerulo dev: Import missing examples',
    'JSONDerulo dev: Re-import all examples',
  ]);

  // Only the menu item imports, and every example gets its check.
  mine.ctx.importDevExamples();
  const count = name => mine.sheets.calls.filter(c => c === name).length;
  assert.strictEqual(count('createNewSheet'), 9);
  assert.strictEqual(count('addImportCheck'), 9);
  assert.strictEqual(count('toast'), 0);
});
