# JSONDerulo
Google Apps Script Spreadsheet utils to work with JSONs. Convert from Sheet to JSON and vice versa.

# From sheet to JSON

## `=ToJSON(properties, values)`
Builds a JSON object from a row of property names and a row of values.

| | A | B | C | D |
|---|---|---|---|---|
| 1 | squadcoins.type | squadcoins.min.x | squadcoins.min.y | gold |
| 2 | Plastic | 3 | 6 | 2 |

`=ToJSON(A1:D1, A2:D2)` → `{"squadcoins":{"type":"Plastic","min":{"x":3,"y":6}},"gold":2}`

- **Dots nest objects:** `a.b.c` puts the value in `{"a":{"b":{"c":...}}}`.
- **One range works too:** `=ToJSON(A1:D2)` takes the property names from the first row and the values from the rows below.
- **Several rows give a list:** `=ToJSON(A1:D1, A2:D10)` returns one object per row and skips empty rows.
- **Properties and values can also be columns:** `=ToJSON(A1:A4, B1:B4)`.
- **Number headers** like `2020` become the key `"2020"`. They are never split on dots, and JavaScript always puts integer-like keys first in the output.
- **Empty header cells are skipped** if their value is empty too. A value with no header is an error.
- **Conflicts are errors:** setting the same property twice, or using `a` as a value and also as `a.b`, gives an error instead of silently losing data. A cell holding a JSON object can be combined with dotted properties under the same name (`a` = `{"x":1}` and `a.y` = `2` → `{"a":{"x":1,"y":2}}`).

## `=ToJSONList(value1, value2, ...)`
Builds a JSON list from cells, ranges or values: `=ToJSONList(B2:D2)` → `["a","b",3]`. Empty cells are skipped.

## How cell values are read
| Cell | JSON |
|---|---|
| `5` | `5` |
| `hello` | `"hello"` |
| TRUE / FALSE (checkbox) | `true` / `false` |
| `{"a":1}` or `[1,2]` (for example the result of another `ToJSON`) | that object or list, so you can nest formulas |
| `"007"` (in quotes) | the string `"007"`. Use this to force text, and `""` for an empty string |
| `null` | `null` (write `"null"` for the text) |
| `{player}` (looks like JSON but isn't) | the text as-is |
| A date | `"2024-01-01"`, or `"2024-01-01T09:30:00"` if it has a time, in the spreadsheet's time zone |
| empty | `""` in `ToJSON`, skipped in `ToJSONList` |

## Size limit
A Google Sheets cell holds at most 50,000 characters. If a result is bigger, the function gives an error that says so. Split the data across several cells.

# From JSON to sheet
Open **JSONDerulo → Create sheet from JSON**, then paste the JSON or load it from a file. You get a new tab (`ImportedJSON (n)`, or the name you give it) laid out so you can edit values, with A2 rebuilding the JSON:

- **Objects** become a block of columns: property names in row 1 (nested objects use dots, e.g. `value.Value.Amount`), values in row 2, and `=ToJSON(<block>)`.
- **Lists of objects with the same properties** become a table, one row per object, rebuilt with a single `=ToJSON(<table>)`.
- **Other lists** become a column (`items`) from row 2 down, rebuilt with `=ToJSONList(<column>)`.
- **Nested objects and lists** get their own block further right. The cell that holds them gets the formula, and the empty column before the block has the path in row 1 (e.g. `value.Rewards[0]`).
- **Text stays text:** text cells use the plain text format, and text that would read back as something else (`"1"`, `"true"`, `"null"`, `""`, text starting with `=`) is written in quotes.
- **Property names that can't be headers** (containing a dot, empty, or starting with `=` or `'`) keep their object as JSON text in one cell.

Every generated formula takes a single range, so it works whatever the spreadsheet's locale uses as the argument separator (`,` or `;`).

The layout is built in [src/Importer.js](src/Importer.js) without touching Sheets and written in a few calls, so large JSONs import quickly. The sheet limits still apply: 18,278 columns, 10 million cells, and 50,000 characters per cell, which includes the JSON that A2 rebuilds.

# Development
The code is in plain `.js` files in `src/` and runs as-is in both Apps Script and Node.

```bash
npm test
```

The tests load `src/` the same way Apps Script does (one shared global scope) and call the custom functions with the same 2D arrays Sheets passes them. `test/sheet-cases.test.js` holds the cases from the original test spreadsheet. `test/importer.test.js` imports JSONs, evaluates the resulting grid with a small Sheets simulator (`test/sheet-sim.js`), and checks that the same JSON comes back.

## Pushing to Google Sheets with clasp
1. `npm install`, then `npm run login` (opens the browser to sign in to Google).
2. In the spreadsheet, open **Extensions → Apps Script → Project Settings** and copy the Script ID.
3. Copy `.clasp.json.example` to `.clasp.json` and paste the Script ID into it.
4. `npm run push`. This replaces every file in the Apps Script project with the ones in `src/`. To keep a copy of what's there first, run `npx @google/clasp@3.4.1 clone <Script ID>` in an empty folder outside this repo.

`npm run pull` does the opposite: it overwrites `src/` with what's in the Apps Script project. Use it only if you edited the code in the Apps Script editor.
