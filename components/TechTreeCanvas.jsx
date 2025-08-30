import { useRef, useEffect, useState, useCallback } from 'react'
import { drawGraph } from '../lib/drawGraph.mjs'

export default function TechTreeCanvas({ graph, width = 800, height = 600, scale = 1, bounds, className = '', labelPx = 12, showLabels = true, showEdges = true, interactive = true, filterCategory = null, highlightKey = null, requireSet = null, onNodeClick = null }) {
  const ref = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 }) // CSS px
  const [isPanning, setIsPanning] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    // Handle high-DPI (retina) displays for crisp rendering
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1

    // Ensure backing store matches device pixels while CSS size stays logical pixels
    const displayWidth = Math.max(1, Math.floor(width))
    const displayHeight = Math.max(1, Math.floor(height))
    const backingWidth = Math.max(1, Math.floor(displayWidth * dpr))
    const backingHeight = Math.max(1, Math.floor(displayHeight * dpr))

    // Only resize canvas when needed (resizing resets context state)
    if (canvas.width !== backingWidth) canvas.width = backingWidth
    if (canvas.height !== backingHeight) canvas.height = backingHeight
    canvas.style.width = displayWidth + 'px'
    canvas.style.height = displayHeight + 'px'

    const ctx = canvas.getContext('2d')
    // Reset any prior transforms and clear in device space
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Map 1 canvas unit to 1 CSS pixel (but with higher backing resolution)
    ctx.scale(dpr, dpr)

    drawGraph(ctx, graph, { scale, bounds, labelPx, zoom, panX: pan.x, panY: pan.y, showLabels, showEdges, filterCategory, highlightKey, requireSet })
  }, [graph, scale, bounds, width, height, labelPx, zoom, pan.x, pan.y, showLabels, showEdges, filterCategory, highlightKey, requireSet])

  const onWheel = useCallback((e) => {
    if (!interactive) return
    e.preventDefault()
    const canvas = ref.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const delta = e.deltaY
    const factor = Math.pow(1.0015, -delta) // smooth zoom
    const newZoom = Math.max(0.1, Math.min(8, zoom * factor))
    const screenScale = scale * zoom
    const newScreenScale = scale * newZoom

    // Keep the point under the cursor stationary in screen space
    const newPanX = mx - ((mx - pan.x) / screenScale) * newScreenScale
    const newPanY = my - ((my - pan.y) / screenScale) * newScreenScale

    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }, [interactive, pan.x, pan.y, scale, zoom])

  const onMouseDown = useCallback((e) => {
    if (!interactive) return
    e.preventDefault()
    setIsPanning(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    hasMoved.current = false
  }, [interactive])

  const onMouseMove = useCallback((e) => {
    if (!interactive) return
    if (!isPanning) return
    e.preventDefault()
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [interactive, isPanning])

  const endPan = useCallback((e) => {
    if (isPanning) setIsPanning(false)
    if (!interactive) return
    if (onNodeClick && !hasMoved.current && e && ref.current) {
      // hit test
      const rect = ref.current.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const screenScale = scale * zoom
      const inv = 1 / Math.max(screenScale, 1e-6)
      // world coordinates before the internal offset used in drawGraph
      const pad = 10
      const offX = bounds ? (-bounds.minX + pad) : 0
      const offY = bounds ? (-bounds.minY + pad) : 0
      const wx = (mx - pan.x) * inv - offX
      const wy = (my - pan.y) * inv - offY
      const nodes = Object.entries(graph?.nodes || {})
        .filter(([k, n]) => n && n.pos && typeof n.pos.x === 'number' && typeof n.pos.y === 'number')
        .filter(([k, n]) => !filterCategory || n.category === filterCategory)
      let best = null
      let bestD2 = Infinity
      for (const [k, n] of nodes) {
        const dx = n.pos.x - wx
        const dy = n.pos.y - wy
        const d2 = dx*dx + dy*dy
        const r = 6 * inv // ~6 CSS px hit radius
        if (d2 <= r*r && d2 < bestD2) { bestD2 = d2; best = k }
      }
      if (best) onNodeClick(best)
    }
  }, [interactive, isPanning, onNodeClick, scale, zoom, pan.x, pan.y, graph, filterCategory])

  return (
    <canvas
      ref={ref}
      className={className}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endPan}
      onMouseLeave={endPan}
    />
  )
}
