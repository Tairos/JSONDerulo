// A tiny stand-in for Google Sheets: evaluates the grid from layoutJSON,
// passing cells to the custom functions the way Sheets does.
function columnNumber(letters) {
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
}

const REF = /(\$?)([A-Z]+)(\$?)(\d+)/g;

function parseRange(text) {
  const refs = [...text.trim().matchAll(REF)].map(m => ({ column: columnNumber(m[2]), row: Number(m[4]) }));
  if (refs.length < 1 || refs.length > 2) throw new Error('Unexpected range ' + text);
  return { from: refs[0], to: refs[refs.length - 1] };
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

  // A one-cell range is passed as a single value, bigger ranges as rows.
  function rangeValue({ from, to }) {
    if (from.row === to.row && from.column === to.column) return value(from.row, from.column);
    const rows = [];
    for (let r = from.row; r <= to.row; r++) {
      const row = [];
      for (let c = from.column; c <= to.column; c++) row.push(value(r, c));
      rows.push(row);
    }
    return rows;
  }

  function evaluate(formula) {
    const m = /^=(ToJSON|ToJSONList)\((.*)\)$/.exec(formula);
    if (!m) throw new Error('Unexpected formula ' + formula);
    const args = m[2].split(/[,;]/).map(parseRange).map(rangeValue);
    return ctx[m[1]](...args);
  }

  return { value, evaluate };
}

// Copies row 3 to the given row, like dragging it down in Sheets: references
// without $ before the row number move with it. Changes are then applied as
// {column: value} on the new row.
function fillDown(layout, toRow, changes = {}) {
  const offset = toRow - 3;
  const values = layout.values.map(row => row.slice());
  while (values.length < toRow) values.push(values[0].map(() => ''));
  values[toRow - 1] = values[2].map(v =>
    typeof v === 'string' && v.startsWith('=')
      ? v.replace(REF, (all, c$, col, r$, row) => c$ + col + r$ + (r$ ? row : Number(row) + offset))
      : v);
  const textCells = layout.textCells.concat(layout.textCells.filter(([r]) => r === 3).map(([, c]) => [toRow, c]));
  for (const [letters, v] of Object.entries(changes)) values[toRow - 1][columnNumber(letters) - 1] = v;
  return { ...layout, values, textCells, rows: values.length };
}

module.exports = { simulate, fillDown };
