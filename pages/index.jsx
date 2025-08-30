import Link from 'next/link'
import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/router'
import { normalizeName, topoOrderForTarget, sumCosts, formatNumber } from '../lib/graphUtils.mjs'
import { useGraph } from '../lib/useGraph.mjs'
import { useCategories } from '../lib/useCategories.mjs'
import MiniMap from '../components/MiniMap.jsx'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'
import NodeLink from '../components/NodeLink.jsx'

const SHOW_TIP = false

export default function Home() {
  const router = useRouter()
  const { graph, nodes } = useGraph()
  const [activeKey, setActiveKey] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [listOpen, setListOpen] = useState(true)

  const handleSearchChange = e => {
    const value = e.target.value
    setSearch(value)
    setListOpen(!!value.trim())
  }

  const collapseList = () => setListOpen(false)

  const categories = useCategories(nodes)

  const filtered = useMemo(() => {
    let items = nodes
    if (category) items = items.filter(n => (n.category || '') === category)
    const q = search.trim().toLowerCase()
    if (q) {
      items = items.filter(n => (normalizeName(n) + ' ' + (n.key || '')).toLowerCase().includes(q))
    }
    return items
  }, [nodes, category, search])

  // Sync active key with URL (?key=... or ?node=...)
  useEffect(() => {
    const q = router.query || {}
    const k = (typeof q.key === 'string' ? q.key : (typeof q.node === 'string' ? q.node : null))
    if (k) setActiveKey(k)
  }, [router.query])

  // Expand list when no node is selected
  useEffect(() => {
    setListOpen(!activeKey)
  }, [activeKey])

  const detailNode = activeKey && graph ? graph.nodes[activeKey] : null
  const treeHref = activeKey
    ? { pathname: '/tree', query: { node: activeKey } }
    : '/tree'

  function setActiveAndUpdateUrl(key) {
    setActiveKey(key)
    router.push({ pathname: router.pathname, query: { ...router.query, key } }, undefined, { shallow: true })
  }

  let detailsContent
  if (detailNode) {
    const { order, set: reqSet } = topoOrderForTarget(activeKey, graph)
    const totalCosts = sumCosts(order, graph)
    const reqs = Array.isArray(detailNode.requires) ? detailNode.requires : []
    const unlocks = Array.isArray(detailNode.unlocks) ? detailNode.unlocks : []
    const awards = Array.isArray(detailNode.awards) ? detailNode.awards : []
    const awardsResolved = Array.isArray(detailNode.awardsResolved) ? detailNode.awardsResolved : []

    detailsContent = (
      <>
        <Link href={treeHref}>
          <MiniMap graph={graph} category={detailNode.category} highlightKey={activeKey} requireSet={reqSet} />
        </Link>
        <div className="kv">
          <div className="k">Name</div><div><strong>{detailNode.name || normalizeName({ key: activeKey })}</strong></div>
          <div className="k">Category</div><div>{detailNode.categoryName || detailNode.category || ''}</div>
          {detailNode.type && (<><div className="k">Type</div><div className="muted">{detailNode.type}</div></>)}
          {detailNode.requirementTooltip && (<><div className="k">Requirement Hint</div><div>{detailNode.requirementTooltip}</div></>)}
          {detailNode.description && (<><div className="k">Description</div><div>{detailNode.description}</div></>)}
          {detailNode.icon && (<><div className="k">Icon</div><div className="muted">{detailNode.icon}</div></>)}
          {detailNode.pos && (<><div className="k">Position</div><div className="muted">x:{detailNode.pos.x ?? ''} y:{detailNode.pos.y ?? ''}</div></>)}
        </div>

        <div className="group">
          <h3>Direct Requirements ({reqs.length})</h3>
          <div className="list">{reqs.length ? reqs.map(r => <span key={r}><NodeLink nodeKey={r} onClick={setActiveKey} /></span>) : <span className="muted">None</span>}</div>
        </div>

        <div className="group">
          <h3>Direct Cost</h3>
          <div className="costs">
            {Array.isArray(detailNode.costs) && detailNode.costs.length ?
              detailNode.costs.map((c, idx) => (
                <span key={idx} className="cost"><strong>{c.resourceName || c.resource}</strong>: {formatNumber(c.count)}</span>
              )) : <span className="muted">No costs</span>}
          </div>
        </div>

        <div className="group">
          <h3>Total Cost (including prerequisites)</h3>
          <div className="costs">
            {Object.entries(totalCosts).length ?
              Object.entries(totalCosts).map(([res, amt]) => (
                <span key={res} className="cost"><strong>{res}</strong>: {formatNumber(amt)}</span>
              )) : <span className="muted">No costs</span>}
          </div>
        </div>

        <div className="group">
          <h3>Unlock Steps ({order.length})</h3>
          <ol>
            {order.map(k => <li key={k}><NodeLink nodeKey={k} onClick={setActiveKey} /></li>)}
          </ol>
        </div>

        <div className="group">
          <h3>Awards</h3>
          <div className="list">
            {awards.length ? (
              (awardsResolved.length ? awardsResolved : awards.map(id => ({ id }))).map((ra) => {
                const k = ra.key || (`award:${ra.id}`)
                const baseLabel = ra.name || (ra.key ? ra.key.split('/').pop() : (ra.id || '').split('/').pop())
                const label = ra.visible === false ? `${baseLabel} (hidden)` : baseLabel
                return (
                  <span key={k}><NodeLink nodeKey={k} label={label} onClick={setActiveKey} /></span>
                )
              })
            ) : <span className="muted">None</span>}
          </div>
        </div>

        <div className="group">
          <h3>Direct Unlocks ({unlocks.length})</h3>
          <div className="list">{unlocks.length ? unlocks.map(u => <span key={u}><NodeLink nodeKey={u} onClick={setActiveKey} /></span>) : <span className="muted">None</span>}</div>
        </div>

        {Array.isArray(detailNode.awardedBy) && detailNode.awardedBy.length > 0 && (
          <div className="group">
            <h3>Awarded By ({detailNode.awardedBy.length})</h3>
            <div className="list">{detailNode.awardedBy.map(u => <span key={u}><NodeLink nodeKey={u} onClick={setActiveKey} /></span>)}</div>
          </div>
        )}
      </>
    )
  } else {
    detailsContent = <div className="placeholder">{graph ? 'Select a node from the list.' : 'Load a graph, then search and select a node.'}</div>
  }

  return (
    <>
      <Header title="RiftBreaker Research Explorer">
        <input
          type="search"
          placeholder="Search by name or key..."
          value={search}
          onChange={handleSearchChange}
        />
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(([val, disp]) => <option key={val} value={val}>{disp}</option>)}
        </select>
        <span id="count" onClick={() => setListOpen(true)} style={{ cursor: 'pointer' }}>{filtered.length} results</span>
        <Link href={treeHref} className="button">Tree View</Link>
      </Header>
      <main className={listOpen ? 'list-open' : ''}>
        <aside>
          <ul id="results">
            {filtered.map(n => (
              <li key={n.key} className={n.key === activeKey ? 'active' : ''} onClick={() => setActiveAndUpdateUrl(n.key)}>
                <div>{normalizeName(n)}</div>
              </li>
            ))}
          </ul>
        </aside>
        <section id="details" onClick={collapseList}>
          {detailsContent}
        </section>
      </main>
      <Footer tip={SHOW_TIP ? 'Tip: Use analyze_research.ts to generate research_graph.json, and gui2lookup.ts to fill readable names.' : null} />
    </>
  )
}
