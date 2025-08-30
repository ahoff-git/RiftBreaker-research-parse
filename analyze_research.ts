// analyze_research.ts
// Normalize research_tree.json into a graph and optionally enrich with English labels and descriptions
// Usage:
//   ts-node analyze_research.ts <research_tree.json> [gui_lookup.json] [out.json]
// Produces a JSON with nodes keyed by research_name and reverse edges (unlocks)

import fs from "fs";
import path from "path";
import { stripLevelSuffix, stripItemTierSuffix, weaponSynonym } from "./lib/blueprintUtils";

type Lookup = Record<string, string>;

type Cost = { resource: string; count: number; resourceName?: string };
type ResolvedAward = { id: string; key?: string; name?: string; desc?: string; type?: 'building'|'weapon'|'resource'; visible?: boolean };
type NodeRecord = {
  key: string;                  // research_name (gui key)
  name?: string;                // English label (from gui_lookup)
  description?: string;         // English description (from gui_lookup)
  category?: string;            // tree category (gui key)
  categoryName?: string;        // English category (from gui_lookup)
  icon?: string;
  pos?: { x?: number; y?: number };
  costs?: Cost[];
  awards?: string[];            // blueprints unlocked
  awardsVisibility?: Record<string, boolean>; // blueprint id -> is_visible flag
  requires: string[];           // prerequisite research keys
  unlocks: string[];            // filled by reverse edges
  awardsResolved?: ResolvedAward[]; // award names resolved via GUI lookup
  // For synthetic award/include nodes, track which research grants them
  awardedBy?: string[];
  requirementTooltipKey?: string; // optional GUI key for requirement tooltip
  requirementTooltip?: string;    // resolved requirement tooltip (English)
  type?: 'building'|'weapon'|'resource'; // used by synthetic award/include nodes
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
      const awardsVisibility: Record<string, boolean> = {};
      for (const a of toArray<any>(awardsRaw)) {
        const bp = a?.blueprint;
        if (typeof bp === "string") {
          awards.push(bp);
          const visRaw = a?.is_visible;
          if (visRaw === "1" || visRaw === 1 || visRaw === true) awardsVisibility[bp] = true;
          else if (visRaw === "0" || visRaw === 0 || visRaw === false) awardsVisibility[bp] = false;
        }
      }

      // Requirement tooltip key (optional)
      let requirementTooltipKey: string | undefined;
      const rt = n.requirement_tooltip;
      if (typeof rt === 'string') requirementTooltipKey = rt;

      out.push({
        key,
        category,
        icon,
        pos,
        costs: costs.length ? costs : undefined,
        awards: awards.length ? awards : undefined,
        awardsVisibility: Object.keys(awardsVisibility).length ? awardsVisibility : undefined,
        requires: reqs,
        unlocks: [],
        requirementTooltipKey
      });
    }
  }

  return out;
}

function propagateCategories(map: Record<string, NodeRecord>, lookup?: Lookup): void {
  const cache = new Map<string, string | undefined>();
  const resolve = (key: string, stack: Set<string> = new Set()): string | undefined => {
    if (cache.has(key)) return cache.get(key);
    const node = map[key];
    if (!node) return undefined;
    if (node.category) {
      cache.set(key, node.category);
      return node.category;
    }
    if (stack.has(key)) return undefined;
    stack.add(key);
    for (const req of node.requires) {
      const cat = resolve(req, stack);
      if (cat) {
        cache.set(key, cat);
        stack.delete(key);
        return cat;
      }
    }
    stack.delete(key);
    cache.set(key, undefined);
    return undefined;
  };

  for (const n of Object.values(map)) {
    if (!n.category) {
      const cat = resolve(n.key);
      if (cat) {
        n.category = cat;
        if (lookup && lookup[cat]) n.categoryName = lookup[cat];
      }
    }
  }
}

function buildGraph(nodes: NodeRecord[], lookup?: Lookup): Record<string, NodeRecord> {
  const byKey: Record<string, NodeRecord> = {};
  for (const n of nodes) {
    byKey[n.key] = { ...n };
    if (lookup) {
      if (lookup[n.key]) byKey[n.key].name = lookup[n.key];
      if (n.category && lookup[n.category]) byKey[n.key].categoryName = lookup[n.category];
      // Try to attach an English description: replace '/name/' with '/description/'
      if (typeof n.key === 'string' && n.key.includes('/name/')) {
        const descKey = n.key.replace('/name/', '/description/');
        const desc = lookup[descKey];
        if (desc) byKey[n.key].description = desc;
      }
      // Resolve requirement tooltip if present
      if (n.requirementTooltipKey && lookup[n.requirementTooltipKey]) {
        byKey[n.key].requirementTooltip = lookup[n.requirementTooltipKey];
      }
      // Resolve resource names for costs
      if (Array.isArray(byKey[n.key].costs)) {
        for (const c of byKey[n.key].costs!) {
          const rk = `resource_name/${c.resource}`;
          if (lookup[rk]) c.resourceName = lookup[rk];
        }
      }
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
          const descKey = blueprintToUiDescKey(id, lookup);
          if (descKey) {
            const d = lookup[descKey];
            if (d) ra.desc = d;
          }
          ra.type = classifyBlueprint(id);
        }
        // visibility flag
        if (n.awardsVisibility && Object.prototype.hasOwnProperty.call(n.awardsVisibility, id)) {
          ra.visible = !!n.awardsVisibility[id];
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
  propagateCategories(byKey, lookup);
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
    let synthDesc: string | undefined;
    let synthType: 'building'|'weapon'|'resource' | undefined;
    if (lookup) {
      const uiKey = blueprintToUiKey(awardId, lookup);
      if (uiKey) {
        synthKey = uiKey; // safe: distinct namespace from research keys
        synthName = lookup[uiKey];
        const dKey = blueprintToUiDescKey(awardId, lookup);
        if (dKey && lookup[dKey]) synthDesc = lookup[dKey];
        synthType = classifyBlueprint(awardId);
      }
    }
    if (!synthKey) synthKey = `award:${awardId}`;

    if (!byKey[synthKey]) {
      byKey[synthKey] = {
        key: synthKey,
        name: synthName,
        description: synthDesc,
        type: synthType,
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

function classifyBlueprint(id: string): 'building'|'weapon'|'resource' | undefined {
  if (typeof id !== 'string') return undefined;
  const top = id.split('/')?.[0];
  if (top === 'buildings') return 'building';
  if (top === 'items') return 'weapon';
  if (top === 'resources') return 'resource';
  return undefined;
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

function blueprintToUiDescKey(id: string, lookup: Lookup): string | undefined {
  if (typeof id !== 'string') return undefined;
  const parts = id.split('/');
  if (parts.length < 2) return undefined;
  const top = parts[0];
  const last = parts[parts.length - 1];

  if (top === 'buildings') {
    const base = stripLevelSuffix(last);
    const key = `gui/hud/building_description/${base}`;
    if (lookup[key]) return key;
    const base2 = base.replace(/_(?:\d+|[a-z]{2})$/i, '');
    const key2 = `gui/hud/building_description/${base2}`;
    if (lookup[key2]) return key2;
    return undefined;
  }
  if (top === 'items') {
    const base0 = stripItemTierSuffix(last);
    const base = weaponSynonym(base0);
    const key = `gui/menu/inventory/weapon_charge_description/${base}`;
    if (lookup[key]) return key;
    return undefined;
  }
  // resources usually don't have descriptions here
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
