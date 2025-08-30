import { stripLevelSuffix, stripItemTierSuffix, weaponSynonym } from "./blueprintUtils";

function stripMarkup(text: string | undefined): string | undefined {
  if (!text) return text;
  return text
    .replace(/\s*<img=[^>]+>\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type Lookup = Record<string, string>;

export type Cost = { resource: string; count: number; resourceName?: string };

export type ResolvedAward = {
  id: string;
  key?: string;
  name?: string;
  desc?: string;
  type?: "building" | "weapon" | "resource";
  visible?: boolean;
};

export type NodeRecord = {
  key: string; // research_name (gui key)
  name?: string; // English label (from gui_lookup)
  description?: string; // English description (from gui_lookup)
  category?: string; // tree category (gui key)
  categoryName?: string; // English category (from gui_lookup)
  icon?: string;
  pos?: { x?: number; y?: number };
  costs?: Cost[];
  awards?: string[]; // blueprints unlocked
  awardsVisibility?: Record<string, boolean>; // blueprint id -> is_visible flag
  requires: string[]; // prerequisite research keys
  unlocks: string[]; // filled by reverse edges
  awardsResolved?: ResolvedAward[]; // award names resolved via GUI lookup
  // For synthetic award/include nodes, track which research grants them
  awardedBy?: string[];
  requirementTooltipKey?: string; // optional GUI key for requirement tooltip
  requirementTooltip?: string; // resolved requirement tooltip (English)
  type?: "building" | "weapon" | "resource"; // used by synthetic award/include nodes
};

export function buildGraph(
  nodes: NodeRecord[],
  lookup?: Lookup
): Record<string, NodeRecord> {
  const byKey: Record<string, NodeRecord> = {};
  for (const n of nodes) {
    byKey[n.key] = { ...n };
  }

  if (lookup) {
    attachLookupData(byKey, lookup);
    resolveAwards(byKey, lookup);
  }

  linkReverseEdges(nodes, byKey);
  propagateCategories(byKey, lookup);
  addSyntheticAwardNodes(byKey, lookup);
  return byKey;
}

export function attachLookupData(
  map: Record<string, NodeRecord>,
  lookup: Lookup
): void {
  for (const n of Object.values(map)) {
    if (lookup[n.key]) n.name = stripMarkup(lookup[n.key]);
    if (n.category && lookup[n.category]) n.categoryName = stripMarkup(lookup[n.category]);
    if (typeof n.key === "string" && n.key.includes("/name/")) {
      const descKey = n.key.replace("/name/", "/description/");
      const desc = lookup[descKey];
      if (desc) n.description = stripMarkup(desc);
    }
    if (n.requirementTooltipKey && lookup[n.requirementTooltipKey]) {
      n.requirementTooltip = stripMarkup(lookup[n.requirementTooltipKey]);
    }
    if (Array.isArray(n.costs)) {
      for (const c of n.costs) {
        const rk = `resource_name/${c.resource}`;
        if (lookup[rk]) c.resourceName = stripMarkup(lookup[rk]);
      }
    }
  }
}

export function resolveAwards(
  map: Record<string, NodeRecord>,
  lookup: Lookup
): void {
  for (const n of Object.values(map)) {
    if (!n.awards || !n.awards.length) continue;
    const resolved: ResolvedAward[] = [];
    for (const id of n.awards) {
      const ra: ResolvedAward = { id };
      const key = blueprintToUiKey(id, lookup);
      if (key) {
        ra.key = key;
        const name = lookup[key];
        if (name) ra.name = stripMarkup(name);
        const descKey = blueprintToUiDescKey(id, lookup);
        if (descKey) {
          const d = lookup[descKey];
          if (d) ra.desc = stripMarkup(d);
        }
        ra.type = classifyBlueprint(id);
      }
      if (
        n.awardsVisibility &&
        Object.prototype.hasOwnProperty.call(n.awardsVisibility, id)
      ) {
        ra.visible = !!n.awardsVisibility[id];
      }
      resolved.push(ra);
    }
    if (resolved.length) n.awardsResolved = resolved;
  }
}

export function linkReverseEdges(
  nodes: NodeRecord[],
  map: Record<string, NodeRecord>
): void {
  for (const n of nodes) {
    for (const req of n.requires) {
      const dep = map[req];
      if (dep && !dep.unlocks.includes(n.key)) dep.unlocks.push(n.key);
    }
  }
}

export function addSyntheticAwardNodes(
  map: Record<string, NodeRecord>,
  lookup?: Lookup
): void {
  const awardOwners: Map<string, Set<string>> = new Map();
  for (const n of Object.values(map)) {
    if (!n.awards || !n.awards.length) continue;
    for (const id of n.awards) {
      if (!awardOwners.has(id)) awardOwners.set(id, new Set());
      awardOwners.get(id)!.add(n.key);
    }
  }

  for (const [awardId, owners] of awardOwners.entries()) {
    let synthKey: string | undefined;
    let synthName: string | undefined;
    let synthDesc: string | undefined;
    let synthType: "building" | "weapon" | "resource" | undefined;
    if (lookup) {
      const uiKey = blueprintToUiKey(awardId, lookup);
      if (uiKey) {
        synthKey = uiKey;
        synthName = lookup[uiKey];
        const dKey = blueprintToUiDescKey(awardId, lookup);
        if (dKey && lookup[dKey]) synthDesc = lookup[dKey];
        synthType = classifyBlueprint(awardId);
      }
    }
    if (!synthKey) synthKey = `award:${awardId}`;

    if (!map[synthKey]) {
      map[synthKey] = {
        key: synthKey,
        name: synthName,
        description: synthDesc,
        type: synthType,
        requires: Array.from(owners),
        unlocks: [],
        awardedBy: Array.from(owners),
      };
    } else {
      const node = map[synthKey];
      const reqSet = new Set(node.requires || []);
      for (const o of owners) reqSet.add(o);
      node.requires = Array.from(reqSet);
      const bySet = new Set(node.awardedBy || []);
      for (const o of owners) bySet.add(o);
      node.awardedBy = Array.from(bySet);
    }
    for (const o of owners) {
      const ownerNode = map[o];
      if (ownerNode && !ownerNode.unlocks.includes(synthKey)) {
        ownerNode.unlocks.push(synthKey);
      }
    }
  }
}

function propagateCategories(
  map: Record<string, NodeRecord>,
  lookup?: Lookup
): void {
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

function classifyBlueprint(id: string): "building" | "weapon" | "resource" | undefined {
  if (typeof id !== "string") return undefined;
  const top = id.split("/")?.[0];
  if (top === "buildings") return "building";
  if (top === "items") return "weapon";
  if (top === "resources") return "resource";
  return undefined;
}

function blueprintToUiKey(id: string, lookup: Lookup): string | undefined {
  if (typeof id !== "string") return undefined;
  const parts = id.split("/");
  if (parts.length < 2) return undefined;
  const top = parts[0];
  const last = parts[parts.length - 1];

  if (top === "buildings") {
    const base = stripLevelSuffix(last);
    const key = `gui/hud/building_name/${base}`;
    if (lookup[key]) return key;
    const base2 = base.replace(/_(?:\d+|[a-z]{2})$/i, "");
    const key2 = `gui/hud/building_name/${base2}`;
    if (lookup[key2]) return key2;
    return undefined;
  }

  if (top === "items") {
    const base0 = stripItemTierSuffix(last);
    const base = weaponSynonym(base0);
    const key = `gui/menu/inventory/weapon_name/${base}`;
    if (lookup[key]) return key;
    return undefined;
  }

  if (top === "resources") {
    const key = `resource_name/${last}`;
    if (lookup[key]) return key;
    return undefined;
  }
  return undefined;
}

function blueprintToUiDescKey(id: string, lookup: Lookup): string | undefined {
  if (typeof id !== "string") return undefined;
  const parts = id.split("/");
  if (parts.length < 2) return undefined;
  const top = parts[0];
  const last = parts[parts.length - 1];

  if (top === "buildings") {
    const base = stripLevelSuffix(last);
    const key = `gui/hud/building_description/${base}`;
    if (lookup[key]) return key;
    const base2 = base.replace(/_(?:\d+|[a-z]{2})$/i, "");
    const key2 = `gui/hud/building_description/${base2}`;
    if (lookup[key2]) return key2;
    return undefined;
  }
  if (top === "items") {
    const base0 = stripItemTierSuffix(last);
    const base = weaponSynonym(base0);
    const key = `gui/menu/inventory/weapon_charge_description/${base}`;
    if (lookup[key]) return key;
    return undefined;
  }
  return undefined;
}

