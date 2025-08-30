import { useMemo } from 'react'
import TechTreeCanvas from './TechTreeCanvas.jsx'
import { graphBounds, graphBoundsForCategory, graphBoundsForNodeTree, computeScale } from '../lib/graphUtils.mjs'

export default function MiniMap({ graph, category = null, highlightKey = null, width = 200, height = 150, requireSet = null }) {
  const boundsAll = useMemo(() => graphBounds(graph), [graph])
  const bounds = useMemo(() => {
    if (highlightKey) {
      const b = graphBoundsForNodeTree(graph, highlightKey)
      if (b) return b
    }
    return category ? (graphBoundsForCategory(graph, category) || boundsAll) : boundsAll
  }, [graph, category, highlightKey, boundsAll])
  const border = 1
  const innerWidth = Math.max(0, width - border * 2)
  const innerHeight = Math.max(0, height - border * 2)
  const scale = useMemo(() => computeScale(innerWidth, innerHeight, bounds), [innerWidth, innerHeight, bounds])
  return (
    <TechTreeCanvas
      graph={graph}
      bounds={bounds}
      width={innerWidth}
      height={innerHeight}
      scale={scale}
      labelPx={8}
      showLabels={false}
      showEdges={true}
      interactive={false}
      filterCategory={category}
      highlightKey={highlightKey}
      requireSet={requireSet}
      className="techtree-mini"
    />
  )
}
