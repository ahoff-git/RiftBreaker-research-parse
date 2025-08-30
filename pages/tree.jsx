import { useMemo } from 'react'
import { useGraph } from '../lib/useGraph.mjs'
import { graphBounds, computeScale } from '../lib/graphUtils.mjs'
import TechTreeCanvas from '../components/TechTreeCanvas.jsx'

const MAIN_WIDTH = 800
const MAIN_HEIGHT = 600
const MINI_WIDTH = 200
const MINI_HEIGHT = 150

export default function Tree() {
  const { graph } = useGraph()
  const bounds = useMemo(() => graphBounds(graph), [graph])

  const mainScale = useMemo(
    () => computeScale(MAIN_WIDTH, MAIN_HEIGHT, bounds),
    [bounds]
  )

  const miniScale = useMemo(
    () => computeScale(MINI_WIDTH, MINI_HEIGHT, bounds),
    [bounds]
  )

  return (
    <div className="techtree-container">
      <h1>Research Tech Tree</h1>
      <TechTreeCanvas
        graph={graph}
        bounds={bounds}
        width={MAIN_WIDTH}
        height={MAIN_HEIGHT}
        scale={mainScale}
        className="techtree-main"
      />
      <TechTreeCanvas
        graph={graph}
        bounds={bounds}
        width={MINI_WIDTH}
        height={MINI_HEIGHT}
        scale={miniScale}
        className="techtree-mini"
      />
    </div>
  )
}
