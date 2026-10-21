# JSONDerulo
Edit JSON in Google Sheets. JSONDerulo turns spreadsheet rows into JSON with two custom functions, and turns JSON back into an editable sheet with one menu click.

It's made for config files: game balancing, stock, item tables and so on. Those are easier to read and tweak in a spreadsheet, but the program that uses them needs JSON.

```
        Sheet                                   JSON
| box.type | box.max | price |
| Plastic         | 4              | 2    |   →   {"box":{"type":"Plastic","max":4},"price":2}
```

- [Features](#features)
- [Setup](#setup)
- [From sheet to JSON](#from-sheet-to-json)
- [From JSON to sheet](#from-json-to-sheet)
- [Limits](#limits)
- [Development](#development)

# Features
- **`=ToJSON(...)`** builds an object, or a list of objects, from a header row and value rows. Dots in headers nest objects (`value.Value.Amount`).
- **`=ToJSONList(...)`** builds a list from cells and ranges.
- **Formulas nest:** a cell holding JSON, such as the result of another `ToJSON`, goes in as JSON, so any shape can be built.
- **JSONDerulo → Create sheet from JSON** imports a JSON into a new tab, already wired with the formulas that rebuild it. Edit the values, and A2 has the updated JSON.
- **Round trips:** importing a JSON and reading A2 gives back exactly the same JSON, including text like `"007"`, `"true"` and `""`, `null`, and empty objects and lists.
- **Locale-safe:** generated formulas take a single range, so they work whether the spreadsheet uses `,` or `;` between function arguments.
- **Clear errors** for conflicting headers, results too big for a cell, and invalid JSON, instead of silently losing data.

# Setup
JSONDerulo is an Apps Script project attached to a spreadsheet. Pick one of the two ways below to add it to yours.

## Option A: push with clasp (recommended)
[clasp](https://github.com/google/clasp) is Google's command-line tool for Apps Script. It uploads the code in `src/` to your spreadsheet's script in one command, so the spreadsheet always matches this repo.

You'll need [Node.js](https://nodejs.org/) 20 or later.

1. **Install the dependencies** (clasp included):
   ```bash
   npm install
   ```
2. **Turn on the Apps Script API** for your Google account at [script.google.com/home/usersettings](https://script.google.com/home/usersettings). It's off by default, and without it clasp fails with "User has not enabled the Apps Script API".
3. **Log in:**
   ```bash
   npm run login
   ```
   Open the link it prints. Google asks for several permissions, because clasp requests everything any of its commands might use. **JSONDerulo only needs one of them**, so untick the rest:

   | Permission | Needed? |
   |---|---|
   | **Create and update Google Apps Script projects** (*Crear y actualizar proyectos de Google Apps Script*) | ✅ **Yes**, used to push and pull the code |
   | Create and update Google Apps Script deployments | ❌ Only for publishing versions or deployments |
   | Publish this application as a web app | ❌ This isn't a web app |
   | See information about your Google Drive files | ❌ Only for `clasp list` |
   | See, edit, create and delete only the Google Drive files you use with this app | ❌ Only for `clasp create` |
   | View, modify, configure and delete your Google Cloud data | ❌ Only for `clasp apis` and Cloud logs |
   | Manage your Google API service configuration | ❌ Only for enabling APIs from the command line |
   | View log data for your projects | ❌ Only for `clasp logs`; the Apps Script editor shows logs anyway |

   The login is saved in `~/.clasprc.json` on your computer. If a clasp command later complains about a missing permission, run `npm run login` again and tick only the one it needs. To remove clasp's access entirely, use [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

4. **Point clasp at your spreadsheet's script.** In the spreadsheet, open **Extensions → Apps Script → Project Settings** (gear icon) and copy the **Script ID**. Then copy the example config and paste the ID into it:
   ```bash
   cp .clasp.json.example .clasp.json
   ```
   `.clasp.json` is gitignored, so your Script ID stays out of the repo.

5. **Push:**
   ```bash
   npm run push
   ```
   This replaces every file in the Apps Script project with the ones in `src/`. Files that aren't in `src/` are deleted from the project. To keep a copy of what's there first, run `npx @google/clasp clone <Script ID>` in an empty folder outside this repo.

6. **Reload the spreadsheet.** The **JSONDerulo** menu appears, and `=ToJSON` / `=ToJSONList` work in any cell. The first time you use the menu, Google asks you to authorize the script. That authorization covers JSONDerulo itself (editing the spreadsheet and showing the import dialog) and is separate from clasp's.

`npm run pull` does the opposite of push: it overwrites `src/` with what's in the Apps Script project. Use it only if you edited the code in the Apps Script editor.

## Option B: copy and paste
No tools or permissions needed, just more clicking each time the code changes.

1. In the spreadsheet, open **Extensions → Apps Script**.
2. For each `.js` file in [src/](src/), add a script file (**+ → Script**) with the same name and paste its contents in.
3. Add an HTML file (**+ → HTML**) called `ImportPopup` and paste in [src/ImportPopup.html](src/ImportPopup.html).
4. Save, then reload the spreadsheet.

# From sheet to JSON

## `=ToJSON(properties, values)`
Builds a JSON object from a row of property names and a row of values.

| | A | B | C | D |
|---|---|---|---|---|
| 1 | box.type | box.min.x | box.min.y | price |
| 2 | Plastic | 3 | 6 | 2 |

`=ToJSON(A1:D1, A2:D2)` → `{"box":{"type":"Plastic","min":{"x":3,"y":6}},"price":2}`

- **Dots nest objects:** `a.b.c` puts the value in `{"a":{"b":{"c":...}}}`.
- **One range works too:** `=ToJSON(A1:D2)` takes the property names from the first row and the values from the rows below.
- **Several rows give a list:** `=ToJSON(A1:D1, A2:D10)` returns one object per row and skips empty rows.
- **Properties and values can also be columns:** `=ToJSON(A1:A4, B1:B4)`.
- **Number headers** like `2020` become the key `"2020"`. They are never split on dots, and JavaScript always puts integer-like keys first in the output.
- **Empty header cells are skipped** if their value is empty too. A value with no header is an error.
- **Conflicts are errors:** setting the same property twice, or using `a` as a value and also as `a.b`, gives an error instead of silently losing data. A cell holding a JSON object can be combined with dotted properties under the same name (`a` = `{"x":1}` and `a.y` = `2` → `{"a":{"x":1,"y":2}}`).

## `=ToJSONList(value1, value2, ...)`
Builds a JSON list from cells, ranges or values: `=ToJSONList(B2:D2)` → `["a","b",3]`. Empty cells are skipped.

## Nesting
Any cell holding JSON is used as JSON, so formulas can be combined:

| | A | B | C | D |
|---|---|---|---|---|
| 1 | _size | _weight | | sizes |
| 2 | Small | 160 | `=ToJSON($A$1:$B$1, A2:B2)` | `=ToJSONList(C2:C3)` |
| 3 | Medium | 650 | `=ToJSON($A$1:$B$1, A3:B3)` | |

D2 → `[{"_size":"Small","_weight":160},{"_size":"Medium","_weight":650}]`. In this case `=ToJSON(A1:B3)` gives the same result in one formula.

## How cell values are read
| Cell | JSON |
|---|---|
| `5` | `5` |
| `hello` | `"hello"` |
| TRUE / FALSE (checkbox) | `true` / `false` |
| `{"a":1}` or `[1,2]` (for example the result of another `ToJSON`) | that object or list |
| `"007"` (in quotes) | the string `"007"`. Use this to force text, and `""` for an empty string |
| `null` | `null` (write `"null"` for the text) |
| `{player}` (looks like JSON but isn't) | the text as-is |
| A date | `"2024-01-01"`, or `"2024-01-01T09:30:00"` if it has a time. Dates use the spreadsheet's own time zone (**File → Settings**), so the result doesn't depend on who opens it |
| empty | `""` in `ToJSON`, skipped in `ToJSONList` |

# From JSON to sheet
Open **JSONDerulo → Create sheet from JSON**, then paste the JSON or load it from a file. You get a new tab (`ImportedJSON (n)`, or the name you give it), and A2 rebuilds the JSON:

| | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|
| 1 | JSON | value.id | value.Items | type | value.Items | items | … |
| 2 | `=ToJSON(B1:D2)` | 7 | `=ToJSONList(F2:F3)` | Bundle | | `=ToJSON(…)` | … |
| 3 | | | | | | `=ToJSON(…)` | … |

- **Objects** become a block of columns: property names in row 1 (nested objects use dots), values in row 2, rebuilt with `=ToJSON(<block>)`.
- **Lists of objects with the same properties** become a table, one row per object, rebuilt with a single `=ToJSON(<table>)`. A list of 5,000 items takes a handful of columns.
- **Other lists** become a column (`items`) from row 2 down, rebuilt with `=ToJSONList(<column>)`.
- **Nested objects and lists** get their own block further right. The cell that holds them gets the formula, and the column before the block has its path in row 1 (e.g. `value.Items[0]`).
- **Text stays text:** text cells use the plain text format, and text that would read back as something else (`"1"`, `"true"`, `"null"`, `""`, text starting with `=`) is written in quotes.
- **Property names that can't be headers** (containing a dot, empty, or starting with `=` or `'`) keep their object as JSON text in one cell.

# Limits
These come from Google Sheets:
- **50,000 characters per cell.** That includes the JSON a formula returns, so very large JSONs give an error in A2 saying so. Split the data across several cells, or import parts of it separately.
- **18,278 columns per sheet and 10 million cells per spreadsheet.** The importer checks these before writing anything.
- **Custom functions time out after 30 seconds.** Sheets with thousands of nested formulas can be slow to recalculate.

# Development
```
src/
  CustomFunctions.js   ToJSON and ToJSONList
  Parser.js            reading cells and headers into JSON
  Common.js            shared helpers
  Importer.js          lays a JSON out as a grid (no Sheets calls)
  SheetController.js   writes that grid to a new tab
  UI.js                menu and import dialog
  ImportPopup.html     the import dialog
  appsscript.json      Apps Script manifest
test/
  sheet-cases.test.js  the cases from the original test spreadsheet
  edge-cases.test.js   one test per bug and edge case
  importer.test.js     JSON → sheet → JSON round trips
  sheet-sim.js         a small Sheets stand-in that evaluates the formulas
  load.js              loads src/ the way Apps Script does
```

The code is plain JavaScript and runs as-is in both Apps Script and Node, so everything is tested locally without Google Drive:

```bash
npm test
```

Apps Script loads every file into one shared global scope; there are no imports. `test/load.js` does the same, then the tests call the custom functions with the same 2D arrays Sheets passes them. The importer tests lay a JSON out as a grid, evaluate it with `test/sheet-sim.js`, and check that the same JSON comes back. That simulator also turns untyped text like `007` into numbers, as Sheets does.

The workflow: edit `src/`, run `npm test`, commit, then `npm run push`.

# License
[GPL-3.0](LICENSE)
