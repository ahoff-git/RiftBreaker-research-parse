export function normalizeName(n) {
  if (n && n.name) return n.name;
  const key = n.key || '';
  const seg = key.split('/').pop() || key;
  return seg.replace(/_/g, ' ');
}

export function topoOrderForTarget(target, graph) {
  const visited = new Set();
  const temp = new Set();
  const order = [];
  function visit(k) {
    if (visited.has(k)) return;
    if (temp.has(k)) return;
    temp.add(k);
    const n = graph.nodes[k];
    const reqs = (n && Array.isArray(n.requires)) ? n.requires : [];
    for (const r of reqs) {
      if (graph.nodes[r]) visit(r);
    }
    temp.delete(k);
    visited.add(k);
    order.push(k);
  }
  visit(target);
  return { order, set: visited };
}

export function sumCosts(order, graph) {
  const acc = Object.create(null);
  for (const k of order) {
    const n = graph.nodes[k];
    if (!n || !Array.isArray(n.costs)) continue;
    for (const c of n.costs) {
      if (!c || !c.resource) continue;
      const amt = typeof c.count === 'number' ? c.count : parseFloat(c.count);
      if (!Number.isFinite(amt)) continue;
      acc[c.resource] = (acc[c.resource] || 0) + amt;
    }
  }
  return acc;
}

export function formatNumber(n) {
  try {
    return new Intl.NumberFormat().format(n);
  } catch {
    return String(n);
  }
}

function boundsFromKeys(graph, keys) {
  if (!graph || !graph.nodes || !keys || !keys.length) return null
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const k of keys) {
    const n = graph.nodes[k]
    if (n && n.pos) {
      const { x, y } = n.pos
      if (typeof x === 'number' && typeof y === 'number') {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return minX === Infinity ? null : { minX, maxX, minY, maxY }
}

export function graphBounds(graph) {
  return boundsFromKeys(graph, Object.keys(graph?.nodes || {}))
}

export function computeScale(targetWidth, targetHeight, bounds) {
  if (!bounds) return 1
  const w = bounds.maxX - bounds.minX + 20
  const h = bounds.maxY - bounds.minY + 20
  return Math.min(targetWidth / w, targetHeight / h)
}

export function graphBoundsForCategory(graph, category) {
  if (!graph || !graph.nodes || !category) return graphBounds(graph)
  const keys = Object.entries(graph.nodes)
    .filter(([_, n]) => n && n.category === category)
    .map(([k]) => k)
  const b = boundsFromKeys(graph, keys)
  return b || graphBounds(graph)
}

export function nodeTreeKeys(graph, startKey) {
  const out = new Set()
  if (!graph || !graph.nodes || !startKey || !graph.nodes[startKey]) return out
  const stack = [startKey]
  while (stack.length) {
    const k = stack.pop()
    if (out.has(k)) continue
    const n = graph.nodes[k]
    if (!n) continue
    out.add(k)
    const neighbors = []
    if (Array.isArray(n.requires)) neighbors.push(...n.requires)
    if (Array.isArray(n.unlocks)) neighbors.push(...n.unlocks)
    for (const nb of neighbors) {
      if (graph.nodes[nb]) stack.push(nb)
    }
  }
  return out
}

export function graphBoundsForNodeTree(graph, startKey) {
  if (!graph || !graph.nodes || !startKey) return graphBounds(graph)
  const keys = Array.from(nodeTreeKeys(graph, startKey))
  const b = boundsFromKeys(graph, keys)
  return b || graphBounds(graph)
}
