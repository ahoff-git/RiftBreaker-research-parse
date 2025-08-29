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

## Research graph

Normalize the research tree and build dependency/unlock relationships.

Commands:
- Generate graph (enriched with English labels if available):
  - `npx ts-node analyze_research.ts research_tree.json gui_lookup.json > research_graph.json`

Output structure (research_graph.json):
- `stats`: counts
- `nodes`: map from research key to an object containing:
  - `name`: English label (if provided by gui_lookup)
  - `category`: research category key
  - `requires`: prerequisite research keys (array)
  - `unlocks`: reverse edges (computed)
  - `costs`: list of `{ resource, count }`
  - `awards`: unlocked blueprint ids
  - `icon`, `pos`: optional metadata

## Static Web App

Explore the research graph in a browser.

- Files: `web/index.html`, `web/app.js`, `web/styles.css`.
- Load `research_graph.json` via the file picker, or click "Try fetch" if serving from the repo root.
- Search by English name or key, filter by category, click a result to view:
  - Direct requirements
  - Total cost including all prerequisites
  - Ordered unlock steps (topological order)
  - Awards and direct unlocks

Serving locally:
- Use any static server, e.g. `npx serve .` or `python -m http.server` then open `/web/`.
- Or open `web/index.html` directly and use the file picker.

Build an English lookup map from `gui/0_ui_*.csv` files and (optionally) filter to only the keys referenced in `research_tree.json`.

Commands:
- Generate full map to stdout:
  - `npx ts-node gui2lookup.ts ./gui > gui_lookup.json`
- Filter to only keys referenced in `research_tree.json` and write to file:
  - `npx ts-node gui2lookup.ts ./gui research_tree.json gui_lookup.json`

Notes:
- The parser treats the first semicolon as the delimiter and preserves remaining semicolons in the text, handling simple quoted values.
- It prefers language `1` (English) when multiple `0_ui_*.csv` are present. If English is missing, it falls back to the lowest available language number.
