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

export function graphBounds(graph) {
  if (!graph || !graph.nodes) return null
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of Object.values(graph.nodes)) {
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
  if (minX === Infinity) return null
  return { minX, maxX, minY, maxY }
}

export function computeScale(targetWidth, targetHeight, bounds) {
  if (!bounds) return 1
  const w = bounds.maxX - bounds.minX + 20
  const h = bounds.maxY - bounds.minY + 20
  return Math.min(targetWidth / w, targetHeight / h)
}

// Compute bounds for a specific category only
export function graphBoundsForCategory(graph, category) {
  if (!graph || !graph.nodes || !category) return graphBounds(graph)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of Object.values(graph.nodes)) {
    if (n && n.pos && n.category === category) {
      const { x, y } = n.pos
      if (typeof x === 'number' && typeof y === 'number') {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (minX === Infinity) return graphBounds(graph)
  return { minX, maxX, minY, maxY }
}
