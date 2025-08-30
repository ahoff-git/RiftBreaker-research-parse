export function drawGraph(ctx, graph, opts = {}) {
  if (!ctx || !graph || !graph.nodes) return
  const { scale = 1, bounds = null, padding = 10 } = opts
  const nodes = Object.values(graph.nodes).filter(n => n && n.pos && typeof n.pos.x === 'number' && typeof n.pos.y === 'number')
  if (!nodes.length) return
  const b = bounds || nodes.reduce((acc, n) => ({
    minX: Math.min(acc.minX, n.pos.x),
    maxX: Math.max(acc.maxX, n.pos.x),
    minY: Math.min(acc.minY, n.pos.y),
    maxY: Math.max(acc.maxY, n.pos.y)
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
  const offsetX = -b.minX + padding
  const offsetY = -b.minY + padding
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(offsetX, offsetY)
  ctx.lineWidth = 1
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // draw edges
  ctx.strokeStyle = '#555'
  for (const [key, n] of Object.entries(graph.nodes)) {
    if (!n.pos || !Array.isArray(n.unlocks)) continue
    for (const u of n.unlocks) {
      const t = graph.nodes[u]
      if (!t || !t.pos) continue
      ctx.beginPath()
      ctx.moveTo(n.pos.x, n.pos.y)
      ctx.lineTo(t.pos.x, t.pos.y)
      ctx.stroke()
    }
  }
  // draw nodes
  for (const [key, n] of Object.entries(graph.nodes)) {
    if (!n.pos) continue
    ctx.beginPath()
    ctx.arc(n.pos.x, n.pos.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#0d1117'
    ctx.fill()
    ctx.strokeStyle = '#999'
    ctx.stroke()
    const label = n.name || key.split('/').pop()
    ctx.fillStyle = '#eee'
    ctx.fillText(label, n.pos.x, n.pos.y - 10)
  }
  ctx.restore()
}
