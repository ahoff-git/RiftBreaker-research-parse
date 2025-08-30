import { useMemo } from 'react'
import TechTreeCanvas from './TechTreeCanvas.jsx'
import { graphBounds, graphBoundsForCategory, graphBoundsForNodeTree, computeScale } from '../lib/graphUtils.mjs'

export default function MiniMap({ graph, category = null, highlightKey = null, width = 200, height = 150 }) {
  const boundsAll = useMemo(() => graphBounds(graph), [graph])
  const bounds = useMemo(() => {
    if (highlightKey) {
      const b = graphBoundsForNodeTree(graph, highlightKey)
      if (b) return b
    }
    return category ? (graphBoundsForCategory(graph, category) || boundsAll) : boundsAll
  }, [graph, category, highlightKey, boundsAll])
  const scale = useMemo(() => computeScale(width, height, bounds), [width, height, bounds])
  return (
    <TechTreeCanvas
      graph={graph}
      bounds={bounds}
      width={width}
      height={height}
      scale={scale}
      labelPx={8}
      showLabels={false}
      showEdges={true}
      interactive={false}
      filterCategory={category}
      highlightKey={highlightKey}
      className="techtree-mini"
    />
  )
}
