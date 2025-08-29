1) Open up the `RiftBreaker - Tools`
2) Create a workspace
3) Copy the `gui` and `research` folders into your _workspace_ and then this _project folder_
 - Note, you will be creating folders for `gui` and `research` 
 - `research` will have your `research_tree.rt` file 
 - `gui` will have your `0_ui_*.csv` files (should be about 6 of them)

You'll need to copy and run the following: (these should also be in your package.json file)

npm init -y
npm i -D ts-node peggy
$ npx ts-node rt2json.ts ./research/research_tree.rt > research_tree.json

## GUI lookup generator

Build an English lookup map from `gui/0_ui_*.csv` files and (optionally) filter to only the keys referenced in `research_tree.json`.

Commands:
- Generate full map to stdout:
  - `npx ts-node gui2lookup.ts ./gui > gui_lookup.json`
- Filter to only keys referenced in `research_tree.json` and write to file:
  - `npx ts-node gui2lookup.ts ./gui research_tree.json gui_lookup.json`

Notes:
- The parser treats the first semicolon as the delimiter and preserves remaining semicolons in the text, handling simple quoted values.
- It prefers language `1` (English) when multiple `0_ui_*.csv` are present. If English is missing, it falls back to the lowest available language number.
