// gui2lookup.ts
// Build an English lookup map from gui/0_ui_*.csv files
// Usage:
//   ts-node gui2lookup.ts [guiDir=./gui] [filterJson] [outJson]
// Examples:
//   ts-node gui2lookup.ts ./gui > gui_lookup.json
//   ts-node gui2lookup.ts ./gui research_tree.json gui_lookup.json

import fs from "fs";
import path from "path";
import { stripLevelSuffix, stripItemTierSuffix, weaponSynonym } from "./lib/blueprintUtils";

type Lookup = Map<string, string>; // key -> English text

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

function parseSemicolonCSV(line: string): string[] {
  // Parses a semicolon-separated line with double-quote quoting.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ';') {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function sanitizeEnglish(text: string): string {
  // Replace Unicode punctuation that commonly trips linters/IDEs
  const cleaned = text
    .replace(/[\u2013\u2014]/g, "-")   // en/em dash → hyphen
    .replace(/[\u2018\u2019]/g, "'")   // curly single quotes → '
    .replace(/[\u201C\u201D]/g, '"')   // curly double quotes → "
    .replace(/\u00A0/g, " ")           // non-breaking space → space
    .replace(/\u2026/g, "...")         // ellipsis → ...
    // Strip inline UI image tags like: <img=gui/hud/building_info_tower>
    .replace(/\s*<img=[^>]+>\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
}

function buildEnglishLookup(guiDir: string): Lookup {
  const files = listFilesRecursive(guiDir).filter(p => /0_ui_.*\.csv$/i.test(path.basename(p)));
  const map: Lookup = new Map();
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const lines = raw.split(/\r?\n/);
    for (let line of lines) {
      if (!line) continue;
      // skip comments
      if (/^\s*[#\/]{1,2}/.test(line)) continue;
      const cols = parseSemicolonCSV(line);
      if (cols.length < 2) continue;
      const key = cols[0].trim();
      let english = cols[1].trim();
      english = sanitizeEnglish(english);
      if (!key) continue;
      if (!map.has(key) && english) {
        map.set(key, english);
      }
    }
  }
  return map;
}

function collectGuiKeysFromJson(obj: any, acc: Set<string>) {
  if (obj == null) return;
  const t = typeof obj;
  if (t === "string") {
    const s = obj as string;
    if (s.startsWith("gui/")) acc.add(s);
    return;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) collectGuiKeysFromJson(v, acc);
    return;
  }
  if (t === "object") {
    for (const k of Object.keys(obj)) collectGuiKeysFromJson((obj as any)[k], acc);
    return;
  }
}

function collectBlueprintIdsFromJson(obj: any, acc: Set<string>) {
  if (obj == null) return;
  const t = typeof obj;
  if (t === 'string') {
    const s = obj as string;
    if (/^(buildings|items|resources)\//.test(s)) acc.add(s);
    return;
  }
  if (Array.isArray(obj)) {
    for (const v of obj) collectBlueprintIdsFromJson(v, acc);
    return;
  }
  if (t === 'object') {
    for (const k of Object.keys(obj)) collectBlueprintIdsFromJson((obj as any)[k], acc);
    return;
  }
}

function main() {
  const guiDir = process.argv[2] || path.join(process.cwd(), "gui");
  const maybeFilter = process.argv[3];
  const outPath = process.argv[4];

  if (!fs.existsSync(guiDir) || !fs.statSync(guiDir).isDirectory()) {
    console.error(`GUI directory not found: ${guiDir}`);
    process.exit(2);
  }

  const engMap = buildEnglishLookup(guiDir);

  let keysToInclude: Set<string> | null = null;
  if (maybeFilter && fs.existsSync(maybeFilter) && /\.json$/i.test(maybeFilter)) {
    try {
      const filterRaw = fs.readFileSync(maybeFilter, "utf8");
      const filterJson = JSON.parse(filterRaw);
      keysToInclude = new Set<string>();
      collectGuiKeysFromJson(filterJson, keysToInclude);
      // Also include derived research description keys for every research name key
      // Example: gui/menu/research/name/foo -> gui/menu/research/description/foo
      const extras: string[] = [];
      for (const k of Array.from(keysToInclude)) {
        if (typeof k === 'string' && k.startsWith('gui/menu/research/name/')) {
          extras.push(k.replace('/name/', '/description/'));
        }
      }
      for (const ek of extras) keysToInclude.add(ek);

      // Also include GUI keys for awards (blueprints) present in the filter JSON
      const bpIds = new Set<string>();
      collectBlueprintIdsFromJson(filterJson, bpIds);
      for (const id of Array.from(bpIds)) {
        const parts = id.split('/');
        if (parts.length < 2) continue;
        const top = parts[0];
        const last = parts[parts.length - 1];
        if (top === 'buildings') {
          const base = stripLevelSuffix(last);
          keysToInclude.add(`gui/hud/building_name/${base}`);
          keysToInclude.add(`gui/hud/building_description/${base}`);
          const base2 = base.replace(/_(?:\d+|[a-z]{2})$/i, '');
          keysToInclude.add(`gui/hud/building_name/${base2}`);
          keysToInclude.add(`gui/hud/building_description/${base2}`);
        } else if (top === 'items') {
          const base0 = stripItemTierSuffix(last);
          const base = weaponSynonym(base0);
          keysToInclude.add(`gui/menu/inventory/weapon_name/${base}`);
          keysToInclude.add(`gui/menu/inventory/weapon_charge_description/${base}`);
        } else if (top === 'resources') {
          keysToInclude.add(`resource_name/${last}`);
        }
      }
    } catch (e) {
      console.error("Failed to read/parse filter JSON:", e);
      process.exit(1);
    }
  }

  const out: Record<string, string> = {};
  const keys = Array.from(engMap.keys()).sort();
  for (const k of keys) {
    if (keysToInclude && !keysToInclude.has(k)) continue;
    const txt = engMap.get(k);
    if (txt !== undefined) out[k] = txt;
  }

  const json = JSON.stringify(out, null, 2);
  if (outPath) fs.writeFileSync(outPath, json);
  else process.stdout.write(json + "\n");
}

main();
