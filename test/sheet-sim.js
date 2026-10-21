// A tiny stand-in for Google Sheets: evaluates the grid from layoutJSON,
// passing cells to the custom functions the way Sheets does.
function columnNumber(letters) {
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

function simulate(ctx, layout) {
  const textCells = new Set(layout.textCells.map(([r, c]) => r + ',' + c));
  const cache = new Map();

  function raw(r, c) {
    const row = layout.values[r - 1];
    return row === undefined || row[c - 1] === undefined ? '' : row[c - 1];
  }

  // What a custom function receives for this cell.
  function value(r, c) {
    const key = r + ',' + c;
    if (cache.has(key)) return cache.get(key);
    let v = raw(r, c);
    if (!textCells.has(key) && typeof v === 'string') {
      if (v.startsWith('=')) v = evaluate(v);
      // Sheets turns typed text into numbers and booleans unless the cell is plain text.
      else if (v.trim() !== '' && !isNaN(Number(v))) v = Number(v);
      else if (/^(true|false)$/i.test(v)) v = v.toLowerCase() === 'true';
    }
    cache.set(key, v);
    return v;
  }

  function evaluate(formula) {
    const m = /^=(ToJSON|ToJSONList)\(([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?\)$/.exec(formula);
    if (!m) throw new Error('Unexpected formula ' + formula);
    const [c1, r1] = [columnNumber(m[2]), Number(m[3])];
    const [c2, r2] = m[4] ? [columnNumber(m[4]), Number(m[5])] : [c1, r1];
    let arg;
    if (r1 === r2 && c1 === c2) {
      arg = value(r1, c1);
    } else {
      arg = [];
      for (let r = r1; r <= r2; r++) {
        const row = [];
        for (let c = c1; c <= c2; c++) row.push(value(r, c));
        arg.push(row);
      }
    }
    return ctx[m[1]](arg);
  }

  return { value, evaluate };
}

module.exports = { simulate };
