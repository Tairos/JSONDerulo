# JSONDerulo
Edit JSON in Google Sheets. JSONDerulo turns spreadsheet rows into JSON with two custom functions, and turns JSON back into an editable sheet with one menu click.

It's made for config files: game balancing, product catalogs, item lists and so on. Those are easier to read and tweak in a spreadsheet, but the program that uses them needs JSON.

```
        Sheet                                   JSON
| box.type | box.max | price |
| Plastic         | 4              | 2    |   →   {"box":{"type":"Plastic","max":4},"price":2}
```

- [Features](#features)
- [Setup](#setup)
- [From sheet to JSON](#from-sheet-to-json)
- [From JSON to sheet](#from-json-to-sheet)
- [Example JSONs](#example-jsons)
- [Limits](#limits)
- [Development](#development)

# Features
- **`=ToJSON(...)`** builds an object, or a list of objects, from a header row and value rows. Dots in headers nest objects (`value.Value.Amount`).
- **`=ToJSONList(...)`** builds a list from cells and ranges.
- **Formulas nest:** a cell holding JSON, such as the result of another `ToJSON`, goes in as JSON, so any shape can be built.
- **JSONDerulo → Create sheet from JSON** imports a JSON into a new tab, all on one row and already wired with the formulas that rebuild it. Edit the values, and A3 has the updated JSON.
- **A database of similar JSONs:** drag that row down to get more items with the same structure, one JSON per row.
- **Round trips:** importing a JSON and reading A3 gives back exactly the same JSON, including text like `"007"`, `"true"` and `""`, `null`, and empty objects and lists.
- **Locale-aware:** generated formulas use `,` or `;` between arguments, whichever the spreadsheet's locale expects.
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
- **Quotes keep a header literal:** `"a.b"` (typed with the quotes) is the single key `a.b`, and `""` is the empty key.
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
Open **JSONDerulo → Create sheet from JSON**, then paste the JSON or load it from a file. You get a new tab (`ImportedJSON (n)`, or the name you give it) with the **whole JSON on row 3**, and A3 rebuilds it. For `{"value":{"id":7,"Items":[{"name":"chair","price":40},{"code":"coupon-8","off":8}]},"type":"Bundle"}`:

| | A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | *↳ value.Items* | | | *↳ value.Items[0]* | | | *↳ value.Items[1]* | |
| 2 | **JSON** | **value.id** | **value.Items** | **type** | | **[0]** | **[1]** | | **name** | **price** | | **code** | **off** |
| 3 | `=ToJSON(B$2:D$2, B3:D3)` | 7 | `=ToJSONList(F3:G3)` | Bundle | | `=ToJSON(I$2:J$2, I3:J3)` | `=ToJSON(L$2:M$2, L3:M3)` | | chair | 40 | | coupon-8 | 8 |

Every block has the same three parts: a grey **title** in row 1 saying where it comes from, bold **headers** in row 2 (what `ToJSON` reads), and the **values** in row 3.

- **Objects** become a block of columns (nested objects use dotted headers), rebuilt with `=ToJSON(<headers>, <values>)`.
- **Lists** become a block of columns headed `[0]`, `[1]`…, rebuilt with `=ToJSONList(<values>)`.
- **Nested objects and lists** get their own block further right, after an empty column, titled with their path (e.g. `↳ value.Items[0]`). The cell that holds them gets the formula that reads that block.

## More items with the same structure
Since the whole JSON is on one row, select row 3 and drag it down (or copy and paste it into the rows below). Each new row is another JSON with the same structure, and its A cell rebuilds it:
- **Headers stay fixed** (`B$2:D$2`) and **values follow the row** (`B4:D4`), so every row reads its own values.
- **Lists can be shorter per row:** `ToJSONList` skips empty cells, so clearing `[1]` in a row drops that item from that row's list.
- Lists can't grow past the columns the import created. For longer lists, add a column to the list block and widen its `ToJSONList` range.

## How values are written
- **Text stays text:** text cells use the plain text format, and text that would read back as something else (`"1"`, `"true"`, `"null"`, `""`, text starting with `=`) is written in quotes.
- **Awkward property names** (containing a dot, empty, or starting with `=`, `'` or `"`) get a quoted header like `"key.with.dots"`, which `ToJSON` reads as one literal key.

# Example JSONs
[examples/](examples/) has JSONs for trying the importer. Use **Load from file** in the import dialog:

| File | Shows |
|---|---|
| `01-simple-object.json` | A flat object: one block of columns |
| `02-nested-object.json` | Nested objects flattened into dotted headers |
| `03-table.json` | A list of same-shaped objects, each one its own block |
| `04-mixed-list.json` | Mixed lists, lists of lists, `null` and booleans |
| `05-bundle.json` | Nested lists of objects with different shapes |
| `06-tricky-values.json` | Text that looks like numbers, booleans, `null`, formulas or JSON; empty values; awkward keys |
| `07-config.json` | A settings file with nested lists and an empty list |
| `08-big-table.json` | 400 items, about 2,800 columns and 29,000 characters of JSON in A3 |
| `09-too-big.json` | 1,500 items: imports fine, but A3 shows the 50,000-character limit error |

The tests check that every example comes back unchanged after an import.

# Limits
These come from Google Sheets:
- **50,000 characters per cell.** That includes the JSON a formula returns, so very large JSONs give an error in A3 saying so. Split the data across several cells, or import parts of it separately.
- **18,278 columns per sheet and 10 million cells per spreadsheet.** Every item of every list gets its own columns, so a list of a few thousand objects can run out of columns. The importer checks this before writing anything. Split very long lists into separate imports.
- **Text that looks like a web address becomes a link,** e.g. the header `supplier.name` (`.name` is a real web domain ending). Sheets adds the link whenever such text is written, by hand, by a formula or by the importer, and puts it back if it's removed. It's only cosmetic: the cell still holds the plain text, and that's what `ToJSON` reads.
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
dev/
  DevMenu.js           the dev menu, only pushed by npm run push:dev
scripts/
  build-dev.js         builds build/dev for npm run push:dev
test/
  sheet-cases.test.js  the cases from the original test spreadsheet
  edge-cases.test.js   one test per bug and edge case
  importer.test.js     JSON → sheet → JSON round trips
  dev-menu.test.js     the dev menu only appears in your own spreadsheet
  sheet-sim.js         a small Sheets stand-in that evaluates the formulas
  load.js              loads src/ the way Apps Script does
```

The code is plain JavaScript and runs as-is in both Apps Script and Node, so everything is tested locally without Google Drive:

```bash
npm test
```

Apps Script loads every file into one shared global scope; there are no imports. `test/load.js` does the same, then the tests call the custom functions with the same 2D arrays Sheets passes them. The importer tests lay a JSON out as a grid, evaluate it with `test/sheet-sim.js`, and check that the same JSON comes back. That simulator also turns untyped text like `007` into numbers, as Sheets does.

The workflow: edit `src/`, run `npm test`, commit, then `npm run push`.

## Dev menu
`npm run push:dev` pushes a dev build (`build/dev`, gitignored): `src/` plus [dev/DevMenu.js](dev/DevMenu.js) and a generated file with the examples. After a reload, your spreadsheet gets a **JSONDerulo dev** menu. Opening the spreadsheet doesn't run anything by itself:

- **Import missing examples** imports each file in `examples/` into its own `Example …` tab, skipping tabs that already exist. Each tab gets a check in A1 (`✓ matches` / `✗ differs`) comparing A3 with the original JSON, which is stored in row 1 after the last block.
- **Re-import all examples** deletes the `Example …` tabs and imports them again with the current code.

The menu only appears in the Apps Script project from your `.clasp.json`. A copy of the spreadsheet gets a new script ID, so the menu never shows up there. Run `npm run push` when you're done: it removes the dev files, which embed all the examples and slow down every script run while they're there.

# License
[GPL-3.0](LICENSE)
