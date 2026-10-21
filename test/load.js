// Loads the Apps Script sources into one shared global scope, the same way
// Apps Script does, so the tests can call the custom functions directly.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');

function load(globals = {}) {
  const context = vm.createContext({ Logger: { log() {} }, ...globals });
  for (const file of fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(SRC, file), 'utf8'), context, { filename: file });
  }
  return context;
}

module.exports = { load };
