import { useMemo, useState, useEffect } from 'react'
import { useGraph } from '../lib/useGraph.mjs'
import { graphBounds, computeScale, graphBoundsForCategory, topoOrderForTarget } from '../lib/graphUtils.mjs'
import { useRouter } from 'next/router'
import Link from 'next/link'
import TechTreeCanvas from '../components/TechTreeCanvas.jsx'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'

const MAIN_WIDTH = 800
const MAIN_HEIGHT = 600

export default function Tree() {
  const router = useRouter()
  const { graph } = useGraph()

  // Category options and selection
  const categories = useMemo(() => {
    if (!graph || !graph.nodes) return []
    const set = new Map()
    for (const n of Object.values(graph.nodes)) {
      if (n && n.category) {
        const disp = n.categoryName || n.category
        if (!set.has(n.category)) set.set(n.category, disp)
      }
    }
    return Array.from(set.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1])))
  }, [graph])

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

  const mainScale = useMemo(() => computeScale(MAIN_WIDTH, MAIN_HEIGHT, bounds), [bounds])

  function onNodeClick(key) {
    setHighlightKey(key)
    // Navigate to index page with the selected node
    router.push({ pathname: '/', query: { key } })
  }

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
        <Link href="/" className="button">Main Page</Link>
      </Header>
      <div className="techtree-container">
        <TechTreeCanvas
          graph={graph}
          bounds={bounds}
          width={MAIN_WIDTH}
          height={MAIN_HEIGHT}
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
