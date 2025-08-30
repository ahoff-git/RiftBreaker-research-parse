export function drawGraph(ctx, graph, opts = {}) {
  if (!ctx || !graph || !graph.nodes) return
  const {
    scale = 1,
    bounds = null,
    padding = 10,
    labelPx = 12,
    zoom = 1,
    panX = 0, // CSS px
    panY = 0, // CSS px
    showLabels = true,
    showEdges = true,
    filterCategory = null,
    highlightKey = null,
  } = opts
  const entries = Object.entries(graph.nodes)
  const nodes = entries
    .filter(([k, n]) => n && n.pos && typeof n.pos.x === 'number' && typeof n.pos.y === 'number')
    .filter(([k, n]) => !filterCategory || n.category === filterCategory)
  if (!nodes.length) return
  const b = bounds || nodes.reduce((acc, [, n]) => ({
    minX: Math.min(acc.minX, n.pos.x),
    maxX: Math.max(acc.maxX, n.pos.x),
    minY: Math.min(acc.minY, n.pos.y),
    maxY: Math.max(acc.maxY, n.pos.y)
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
  const offsetX = -b.minX + padding
  const offsetY = -b.minY + padding
  const screenScale = Math.max(1e-6, scale * zoom)
  // Convert CSS-pixel pan into world units for translate-after-scale
  const panWorldX = panX / screenScale
  const panWorldY = panY / screenScale
  ctx.save()
  ctx.scale(screenScale, screenScale)
  ctx.translate(offsetX + panWorldX, offsetY + panWorldY)
  // Keep strokes readable regardless of zoom
  ctx.lineWidth = 1 / screenScale
  // Keep labels at constant on-screen size (approx.)
  const effectiveLabelPx = Math.max(10, labelPx / screenScale)
  ctx.font = `${effectiveLabelPx}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // draw edges (cull when zoomed out)
  if (showEdges && screenScale >= 0.35) {
    ctx.strokeStyle = '#444'
    const allowed = new Set(nodes.map(([k]) => k))
    for (const [key, n] of entries) {
      if (!n.pos || !Array.isArray(n.unlocks)) continue
      if (filterCategory && n.category !== filterCategory) continue
      for (const u of n.unlocks) {
        if (!allowed.has(u)) continue
        const t = graph.nodes[u]
        if (!t || !t.pos) continue
        ctx.beginPath()
        ctx.moveTo(n.pos.x, n.pos.y)
        ctx.lineTo(t.pos.x, t.pos.y)
        ctx.stroke()
      }
    }
  }
  // draw nodes
  const labelGrid = new Set()
  for (const [key, n] of nodes) {
    if (!n.pos) continue
    ctx.beginPath()
    const isHi = key === highlightKey
    const nodeR = isHi ? Math.max(2.5, 5.0 / screenScale) : Math.max(1.5, 3.0 / screenScale)
    ctx.arc(n.pos.x, n.pos.y, nodeR, 0, Math.PI * 2)
    ctx.fillStyle = isHi ? '#11243a' : '#0d1117'
    ctx.fill()
    ctx.strokeStyle = isHi ? '#5eb1ff' : '#999'
    ctx.stroke()
    // labels
    if (showLabels && (screenScale >= 0.8 || isHi)) {
      ctx.fillStyle = '#eee'
      const label = n.name || key.split('/').pop()
      // simple occlusion culling grid in CSS px
      // compute screen position in CSS px without dpr (already handled outside)
      const screenX = (n.pos.x + offsetX + panWorldX) * screenScale
      const dy = isHi ? 14 : 10
      const screenY = (n.pos.y - dy + offsetY + panWorldY) * screenScale
      const cellW = 100, cellH = 18
      const gx = Math.floor(screenX / cellW), gy = Math.floor(screenY / cellH)
      const keyCell = gx + ':' + gy
      if (isHi || !labelGrid.has(keyCell)) {
        labelGrid.add(keyCell)
        ctx.fillText(label, n.pos.x, n.pos.y - dy)
      }
    }
  }
  ctx.restore()
}
