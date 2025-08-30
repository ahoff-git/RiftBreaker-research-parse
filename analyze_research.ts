// analyze_research.ts
// Normalize research_tree.json into a graph and optionally enrich with English labels
// Usage:
//   ts-node analyze_research.ts <research_tree.json> [gui_lookup.json] [out.json]
// Produces a JSON with nodes keyed by research_name and reverse edges (unlocks)

import fs from "fs";
import path from "path";

type Lookup = Record<string, string>;

type Cost = { resource: string; count: number };
type ResolvedAward = { id: string; key?: string; name?: string };
type NodeRecord = {
  key: string;                  // research_name (gui key)
  name?: string;                // English label (from gui_lookup)
  category?: string;            // tree category (gui key)
  categoryName?: string;        // English category (from gui_lookup)
  icon?: string;
  pos?: { x?: number; y?: number };
  costs?: Cost[];
  awards?: string[];            // blueprints unlocked
  requires: string[];           // prerequisite research keys
  unlocks: string[];            // filled by reverse edges
  awardsResolved?: ResolvedAward[]; // award names resolved via GUI lookup
  // For synthetic award/include nodes, track which research grants them
  awardedBy?: string[];
};

function loadJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function toArray<T>(v: any): T[] {
  if (v == null) return [] as T[];
  return Array.isArray(v) ? (v as T[]) : [v as T];
}

function asNum(s: any): number | undefined {
  if (s == null) return undefined;
  if (typeof s === "number") return s;
  if (typeof s === "string") {
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

function pickCategory(tree: any): string | undefined {
  const c = tree?.category;
  return typeof c === "string" ? c : undefined;
}

function extractNodes(data: any): NodeRecord[] {
  // Data may be { Research: { categories: { ResearchTree: [...] } } }
  const root = data?.Research ?? data;
  const cats = root?.categories ?? root?.Categories ?? root;
  const treesRaw = cats?.ResearchTree ?? cats?.researchTree ?? cats;
  const trees = toArray<any>(treesRaw);
  const out: NodeRecord[] = [];

  for (const tree of trees) {
    if (!tree) continue;
    const category = pickCategory(tree);
    const nodesObj = tree?.nodes ?? tree?.Nodes ?? tree;
    const nodesRaw = nodesObj?.ResearchNode ?? nodesObj?.researchNode ?? nodesObj;
    const nodes = toArray<any>(nodesRaw);

    for (const n of nodes) {
      if (!n) continue;
      const key = typeof n.research_name === "string" ? n.research_name : undefined;
      if (!key) continue;
      const icon = typeof n.icon === "string" ? n.icon : undefined;

      const posRaw = n.position;
      const pos = posRaw && typeof posRaw === "object" ? { x: asNum(posRaw.x), y: asNum(posRaw.y) } : undefined;

      // Requirements
      const reqsObj = n.requirements ?? n.Requirements;
      const reqsRaw = reqsObj?.ResearchNodeRequirement ?? reqsObj?.researchNodeRequirement ?? [];
      const reqs: string[] = [];
      for (const r of toArray<any>(reqsRaw)) {
        const rn = r?.research_name;
        if (typeof rn === "string") reqs.push(rn);
      }

      // Costs
      const costsObj = n.research_costs ?? n.costs;
      const costsRaw = costsObj?.ResearchCost ?? costsObj?.researchCost ?? [];
      const costs: Cost[] = [];
      for (const c of toArray<any>(costsRaw)) {
        const resource = typeof c?.resource === "string" ? c.resource : undefined;
        const count = asNum(c?.count);
        if (resource && typeof count === "number") costs.push({ resource, count });
      }

      // Awards (blueprints)
      const awardsObj = n.research_awards ?? n.awards;
      const awardsRaw = awardsObj?.ResearchAward ?? awardsObj?.researchAward ?? [];
      const awards: string[] = [];
      for (const a of toArray<any>(awardsRaw)) {
        const bp = a?.blueprint;
        if (typeof bp === "string") awards.push(bp);
      }

      out.push({ key, category, icon, pos, costs: costs.length ? costs : undefined, awards: awards.length ? awards : undefined, requires: reqs, unlocks: [] });
    }
  }

  return out;
}

function buildGraph(nodes: NodeRecord[], lookup?: Lookup): Record<string, NodeRecord> {
  const byKey: Record<string, NodeRecord> = {};
  for (const n of nodes) {
    byKey[n.key] = { ...n };
    if (lookup) {
      if (lookup[n.key]) byKey[n.key].name = lookup[n.key];
      if (n.category && lookup[n.category]) byKey[n.key].categoryName = lookup[n.category];
    }
  }
  // Resolve award blueprint ids to human-friendly names when possible
  if (lookup) {
    for (const n of Object.values(byKey)) {
      if (!n.awards || !n.awards.length) continue;
      const resolved: ResolvedAward[] = [];
      for (const id of n.awards) {
        const ra: ResolvedAward = { id };
        const key = blueprintToUiKey(id, lookup);
        if (key) {
          ra.key = key;
          const name = lookup[key];
          if (name) ra.name = name;
        }
        resolved.push(ra);
      }
      if (resolved.length) n.awardsResolved = resolved;
    }
  }
  for (const n of nodes) {
    for (const req of n.requires) {
      const dep = byKey[req];
      if (dep) {
        if (!dep.unlocks.includes(n.key)) dep.unlocks.push(n.key);
      }
    }
  }
  // Add synthetic nodes for award "includes" so they appear in the list/search
  // These nodes are keyed by a stable synthetic id and point back to the research that grants them
  const awardOwners: Map<string, Set<string>> = new Map(); // blueprint id -> research keys
  for (const n of Object.values(byKey)) {
    if (!n.awards || !n.awards.length) continue;
    for (const id of n.awards) {
      if (!awardOwners.has(id)) awardOwners.set(id, new Set());
      awardOwners.get(id)!.add(n.key);
    }
  }

  for (const [awardId, owners] of awardOwners.entries()) {
    // Prefer a UI key when available for better naming; otherwise use a synthetic award: prefix
    let synthKey: string | undefined;
    let synthName: string | undefined;
    if (lookup) {
      const uiKey = blueprintToUiKey(awardId, lookup);
      if (uiKey) {
        synthKey = uiKey; // safe: distinct namespace from research keys
        synthName = lookup[uiKey];
      }
    }
    if (!synthKey) synthKey = `award:${awardId}`;

    if (!byKey[synthKey]) {
      byKey[synthKey] = {
        key: synthKey,
        name: synthName,
        // keep category empty to avoid mixing with research filters
        requires: Array.from(owners),
        unlocks: [],
        awardedBy: Array.from(owners)
      };
    } else {
      // If a node with this key already exists (shouldn't for research vs GUI keys), just append relationships
      const node = byKey[synthKey];
      const reqSet = new Set(node.requires || []);
      for (const o of owners) reqSet.add(o);
      node.requires = Array.from(reqSet);
      const bySet = new Set(node.awardedBy || []);
      for (const o of owners) bySet.add(o);
      node.awardedBy = Array.from(bySet);
    }
    // Link reverse edges: each owner research unlocks the award node
    for (const o of owners) {
      const ownerNode = byKey[o];
      if (ownerNode && !ownerNode.unlocks.includes(synthKey)) ownerNode.unlocks.push(synthKey);
    }
  }
  return byKey;
}

function stripLevelSuffix(s: string): string {
  return typeof s === 'string' ? s.replace(/_lvl_\d+$/i, '') : s;
}

function stripItemTierSuffix(s: string): string {
  return typeof s === 'string' ? s
    .replace(/_(advanced|superior|extreme)_item$/i, '')
    .replace(/_item$/i, '')
  : s;
}

function weaponSynonym(id: string): string {
  // Handle common mismatches between blueprint ids and GUI keys
  const map: Record<string, string> = {
    flamer: 'flamethrower',
  };
  return map[id] || id;
}

function blueprintToUiKey(id: string, lookup: Lookup): string | undefined {
  // buildings/... -> gui/hud/building_name/<base>
  // items/weapons/... -> gui/menu/inventory/weapon_name/<base>
  // resources/... -> resource_name/<base>
  if (typeof id !== 'string') return undefined;
  const parts = id.split('/');
  if (parts.length < 2) return undefined;
  const top = parts[0];
  const last = parts[parts.length - 1];

  if (top === 'buildings') {
    const base = stripLevelSuffix(last);
    const key = `gui/hud/building_name/${base}`;
    if (lookup[key]) return key;
    // try dropping variant suffixes like _01/_02
    const base2 = base.replace(/_(?:\d+|[a-z]{2})$/i, '');
    const key2 = `gui/hud/building_name/${base2}`;
    if (lookup[key2]) return key2;
    return undefined;
  }

  if (top === 'items') {
    const base0 = stripItemTierSuffix(last);
    const base = weaponSynonym(base0);
    const key = `gui/menu/inventory/weapon_name/${base}`;
    if (lookup[key]) return key;
    return undefined;
  }

  if (top === 'resources') {
    const key = `resource_name/${last}`;
    if (lookup[key]) return key;
    return undefined;
  }
  return undefined;
}

function main() {
  const inPath = process.argv[2];
  const lookupPath = process.argv[3];
  const outPath = process.argv[4];
  if (!inPath) {
    console.error("Usage: ts-node analyze_research.ts <research_tree.json> [gui_lookup.json] [out.json]");
    process.exit(2);
  }
  if (!fs.existsSync(inPath)) {
    console.error(`Input not found: ${inPath}`);
    process.exit(2);
  }
  const data = loadJson(inPath);
  const nodes = extractNodes(data);
  const lookup: Lookup | undefined = lookupPath && fs.existsSync(lookupPath) ? loadJson(lookupPath) : undefined;
  const graph = buildGraph(nodes, lookup);

  const payload = {
    stats: {
      nodes: nodes.length,
      roots: Object.values(graph).filter(n => n.requires.length === 0).length
    },
    nodes: graph
  };
  const json = JSON.stringify(payload, null, 2);
  if (outPath) fs.writeFileSync(outPath, json);
  else process.stdout.write(json + "\n");
}

main();
