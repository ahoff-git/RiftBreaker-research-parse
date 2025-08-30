import { useRef, useState, useCallback } from 'react'

export function useCanvasPanZoom({ interactive = true, scale = 1, bounds = null, graph = null, filterCategory = null, onNodeClick = null }) {
  const ref = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)

  const applyZoom = useCallback((factor, mx, my) => {
    if (!interactive) return
    const canvas = ref.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = typeof mx === 'number' ? mx : rect.width / 2
    const cy = typeof my === 'number' ? my : rect.height / 2
    const newZoom = Math.max(0.1, Math.min(8, zoom * factor))
    const screenScale = scale * zoom
    const newScreenScale = scale * newZoom
    const newPanX = cx - ((cx - pan.x) / screenScale) * newScreenScale
    const newPanY = cy - ((cy - pan.y) / screenScale) * newScreenScale
    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }, [interactive, pan.x, pan.y, scale, zoom])

  const zoomIn = useCallback(() => applyZoom(1.2), [applyZoom])
  const zoomOut = useCallback(() => applyZoom(1 / 1.2), [applyZoom])

  const onWheel = useCallback((e) => {
    if (!interactive) return
    e.preventDefault()
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = Math.pow(1.0015, -e.deltaY)
    applyZoom(factor, mx, my)
  }, [interactive, applyZoom])

  const onMouseDown = useCallback((e) => {
    if (!interactive) return
    e.preventDefault()
    setIsPanning(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    hasMoved.current = false
  }, [interactive])

  const onMouseMove = useCallback((e) => {
    if (!interactive || !isPanning) return
    e.preventDefault()
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }, [interactive, isPanning])

  const endPan = useCallback((e) => {
    if (isPanning) setIsPanning(false)
    if (!interactive) return
    if (onNodeClick && !hasMoved.current && e && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const screenScale = scale * zoom
      const inv = 1 / Math.max(screenScale, 1e-6)
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
        const d2 = dx * dx + dy * dy
        const r = 6 * inv
        if (d2 <= r * r && d2 < bestD2) {
          bestD2 = d2
          best = k
        }
      }
      if (best) onNodeClick(best)
    }
  }, [interactive, isPanning, onNodeClick, scale, zoom, pan.x, pan.y, graph, filterCategory, bounds])

  const canvasProps = {
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp: endPan,
    onMouseLeave: endPan,
  }

  return { ref, zoom, pan, canvasProps, zoomIn, zoomOut }
}

export default useCanvasPanZoom
