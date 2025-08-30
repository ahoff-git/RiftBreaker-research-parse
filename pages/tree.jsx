import { useMemo, useState, useEffect } from 'react'
import { useGraph } from '../lib/useGraph.mjs'
import { graphBounds, computeScale, graphBoundsForCategory, topoOrderForTarget } from '../lib/graphUtils.mjs'
import { useCategories } from '../lib/categories.mjs'
import { useRouter } from 'next/router'
import Link from 'next/link'
import TechTreeCanvas from '../components/TechTreeCanvas.jsx'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'

const WIDTH_MARGIN = 32
const HEIGHT_MARGIN = 200

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

function useCanvasSize({
  minWidth = 400,
  maxWidth = 1600,
  minHeight = 300,
  maxHeight = 1200
} = {}) {
  const [size, setSize] = useState({ width: minWidth, height: minHeight })

  useEffect(() => {
    function update() {
      const width = clamp(window.innerWidth - WIDTH_MARGIN, minWidth, maxWidth)
      const height = clamp(window.innerHeight - HEIGHT_MARGIN, minHeight, maxHeight)
      setSize({ width, height })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [minWidth, maxWidth, minHeight, maxHeight])

  return size
}

export default function Tree() {
  const router = useRouter()
  const { graph } = useGraph()
  const { width: canvasWidth, height: canvasHeight } = useCanvasSize()

  // Category options and selection
  const categories = useCategories(graph)

  const [category, setCategory] = useState('')
  const [highlightKey, setHighlightKey] = useState('')

  // Sync from URL: ?category=...&node=...
  useEffect(() => {
    const q = router.query || {}
    const catQ = typeof q.category === 'string' ? q.category : ''
    const nodeQ = typeof q.node === 'string' ? q.node : ''
    if (catQ) setCategory(catQ)
    if (nodeQ) setHighlightKey(nodeQ)
  }, [router.query])

  // Default to first category if none selected
  useEffect(() => {
    if (!category && categories.length) setCategory(categories[0][0])
  }, [categories, category])

  // If a highlight node is specified, ensure its category is selected
  useEffect(() => {
    if (!graph || !highlightKey) return
    const n = graph.nodes && graph.nodes[highlightKey]
    if (n && n.category && n.category !== category) setCategory(n.category)
  }, [graph, highlightKey])

  const boundsAll = useMemo(() => graphBounds(graph), [graph])
  const bounds = useMemo(() => graphBoundsForCategory(graph, category) || boundsAll, [graph, category, boundsAll])
  const reqSet = useMemo(() => {
    if (!graph || !highlightKey) return null
    return topoOrderForTarget(highlightKey, graph).set
  }, [graph, highlightKey])

  const mainScale = useMemo(() => computeScale(canvasWidth, canvasHeight, bounds), [bounds, canvasWidth, canvasHeight])

  function onNodeClick(key) {
    setHighlightKey(key)
    router.replace({ pathname: router.pathname, query: { ...router.query, node: key } }, undefined, { shallow: true })
  }

  const detailsHref = highlightKey
    ? { pathname: '/', query: { key: highlightKey } }
    : '/'

  return (
    <>
      <Header title="Research Tech Tree">
        <label>
          <span style={{ marginRight: 6 }}>Category</span>
          <select value={category} onChange={e => {
            const val = e.target.value
            setCategory(val)
            router.replace({ pathname: router.pathname, query: { ...router.query, category: val, node: highlightKey || undefined } }, undefined, { shallow: true })
          }}>
            {categories.map(([val, disp]) => <option key={val} value={val}>{disp}</option>)}
          </select>
        </label>
        <Link href={detailsHref} className="button">Details View</Link>
      </Header>
      <div className="techtree-container">
        <TechTreeCanvas
          graph={graph}
          bounds={bounds}
          width={canvasWidth}
          height={canvasHeight}
          scale={mainScale}
          labelPx={12}
          showLabels={true}
          showEdges={true}
          interactive={true}
          filterCategory={category}
          highlightKey={highlightKey}
          requireSet={reqSet}
          onNodeClick={onNodeClick}
          className="techtree-main"
        />
      </div>
      <Footer />
    </>
  )
}
