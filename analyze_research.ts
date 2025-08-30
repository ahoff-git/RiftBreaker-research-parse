// analyze_research.ts
// Normalize research_tree.json into a graph and optionally enrich with English labels and descriptions
// Usage:
//   ts-node analyze_research.ts <research_tree.json> [gui_lookup.json] [out.json]
// Produces a JSON with nodes keyed by research_name and reverse edges (unlocks)

import fs from "fs";
import { buildGraph, NodeRecord, Lookup, Cost } from "./lib/graphBuilder";

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
