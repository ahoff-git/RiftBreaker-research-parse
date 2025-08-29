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
