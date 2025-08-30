import { useRef, useEffect } from 'react'
import { drawGraph } from '../lib/drawGraph.mjs'

export default function TechTreeCanvas({ graph, width = 800, height = 600, scale = 1, bounds, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    drawGraph(ctx, graph, { scale, bounds })
  }, [graph, scale, bounds])

  return <canvas ref={ref} width={width} height={height} className={className} />
}
