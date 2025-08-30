import { useRef, useState, useCallback } from 'react'

export function useCanvasPanZoom({ interactive = true, scale = 1, bounds = null, graph = null, filterCategory = null, onNodeClick = null }) {
  const ref = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)
  const pointers = useRef(new Map())
  const pinch = useRef(null)

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

  const onPointerDown = useCallback((e) => {
    if (!interactive) return
    e.preventDefault()
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      setIsPanning(true)
      lastPos.current = { x: e.clientX, y: e.clientY }
      hasMoved.current = false
    } else if (pointers.current.size === 2) {
      setIsPanning(false)
      const [p1, p2] = Array.from(pointers.current.values())
      pinch.current = {
        distance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        center: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      }
    }
  }, [interactive])

  const onPointerMove = useCallback((e) => {
    if (!interactive || !pointers.current.has(e.pointerId)) return
    e.preventDefault()
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1 && isPanning) {
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      lastPos.current = { x: e.clientX, y: e.clientY }
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved.current = true
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
    } else if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.values())
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      if (pinch.current) {
        const factor = dist / pinch.current.distance
        applyZoom(factor, center.x, center.y)
        setPan((p) => ({ x: p.x + center.x - pinch.current.center.x, y: p.y + center.y - pinch.current.center.y }))
        hasMoved.current = true
      }
      pinch.current = { distance: dist, center }
    }
  }, [interactive, isPanning, applyZoom])

  const endPointer = useCallback((e) => {
    if (!interactive) return
    if (pointers.current.has(e.pointerId)) pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) {
      if (isPanning) setIsPanning(false)
      if (onNodeClick && !hasMoved.current && e && ref.current) {
        const rect = ref.current.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const screenScale = scale * zoom
        const inv = 1 / Math.max(screenScale, 1e-6)
        const pad = 10
        const offX = bounds ? -bounds.minX + pad : 0
        const offY = bounds ? -bounds.minY + pad : 0
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
    } else if (pointers.current.size === 1) {
      const [p] = Array.from(pointers.current.values())
      lastPos.current = { x: p.x, y: p.y }
      setIsPanning(true)
    } else if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.values())
      pinch.current = {
        distance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        center: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      }
    }
  }, [interactive, isPanning, onNodeClick, scale, zoom, pan.x, pan.y, graph, filterCategory, bounds])

  const canvasProps = {
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerLeave: endPointer,
    onPointerCancel: endPointer,
    style: { touchAction: 'none' },
  }

  return { ref, zoom, pan, canvasProps, zoomIn, zoomOut }
}

export default useCanvasPanZoom
