import { useEffect } from 'react'
import { drawGraph } from '../lib/drawGraph.mjs'
import { useCanvasPanZoom } from '../lib/useCanvasPanZoom.mjs'

export default function TechTreeCanvas({ graph, width = 800, height = 600, scale = 1, bounds, className = '', labelPx = 12, showLabels = true, showEdges = true, edgeMinScale = 0.35, interactive = true, filterCategory = null, highlightKey = null, requireSet = null, onNodeClick = null, onControls = null }) {
  const { ref, zoom, pan, canvasProps, zoomIn, zoomOut } = useCanvasPanZoom({
    interactive,
    scale,
    bounds,
    graph,
    filterCategory,
    onNodeClick,
  })

  useEffect(() => {
    if (onControls) onControls({ zoomIn, zoomOut })
  }, [onControls, zoomIn, zoomOut])

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

    drawGraph(ctx, graph, { scale, bounds, labelPx, zoom, panX: pan.x, panY: pan.y, showLabels, showEdges, filterCategory, highlightKey, requireSet, edgeMinScale })
  }, [graph, scale, bounds, width, height, labelPx, zoom, pan.x, pan.y, showLabels, showEdges, filterCategory, highlightKey, requireSet, edgeMinScale])

  return (
    <canvas
      ref={ref}
      className={className}
      {...canvasProps}
    />
  )
}
