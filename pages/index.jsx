import { useState, useMemo, useEffect } from 'react'
import { normalizeName, topoOrderForTarget, sumCosts, formatNumber } from '../lib/graphUtils.mjs'

const DEFAULT_GRAPH_URL = '/research_graph.json'
const SHOW_TIP = false

export default function Home() {
  const [graph, setGraph] = useState(null)
  const [nodes, setNodes] = useState([])
  const [activeKey, setActiveKey] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  function loadGraphObject(obj) {
    setGraph(obj)
    setNodes(Object.entries(obj.nodes || {}).map(([k, v]) => ({ key: k, ...v })))
  }

  async function loadDefaultGraph() {
    try {
      const res = await fetch(DEFAULT_GRAPH_URL, { cache: 'no-store' })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      loadGraphObject(data)
    } catch (e) {
      alert('Could not fetch research_graph.json.\n' + e)
    }
  }

  useEffect(() => { loadDefaultGraph() }, [])

  const categories = useMemo(() => {
    const cats = new Map()
    nodes.forEach(n => {
      if (n.category) {
        const disp = n.categoryName || n.category
        if (!cats.has(n.category)) cats.set(n.category, disp)
      }
    })
    return Array.from(cats.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1])))
  }, [nodes])

  const filtered = useMemo(() => {
    let items = nodes
    if (category) items = items.filter(n => (n.category || '') === category)
    const q = search.trim().toLowerCase()
    if (q) {
      items = items.filter(n => (normalizeName(n) + ' ' + (n.key || '')).toLowerCase().includes(q))
    }
    return items
  }, [nodes, category, search])

  const detailNode = activeKey && graph ? graph.nodes[activeKey] : null

  function nodeLink(key) {
    const n = graph && graph.nodes && graph.nodes[key]
    const label = n && (n.name || normalizeName({ key })) || key.split('/').pop()
    return (
      <a href="#" className="item" onClick={e => { e.preventDefault(); setActiveKey(key) }}>
        {label}
      </a>
    )
  }

  let detailsContent
  if (detailNode) {
    const { order } = topoOrderForTarget(activeKey, graph)
    const totalCosts = sumCosts(order, graph)
    const reqs = Array.isArray(detailNode.requires) ? detailNode.requires : []
    const unlocks = Array.isArray(detailNode.unlocks) ? detailNode.unlocks : []
    const awards = Array.isArray(detailNode.awards) ? detailNode.awards : []

    detailsContent = (
      <>
        <div className="kv">
          <div className="k">Name</div><div><strong>{detailNode.name || normalizeName({ key: activeKey })}</strong></div>
          <div className="k">Category</div><div>{detailNode.categoryName || detailNode.category || ''}</div>
          {detailNode.icon && (<><div className="k">Icon</div><div className="muted">{detailNode.icon}</div></>)}
          {detailNode.pos && (<><div className="k">Position</div><div className="muted">x:{detailNode.pos.x ?? ''} y:{detailNode.pos.y ?? ''}</div></>)}
        </div>

        <div className="group">
          <h3>Direct Requirements ({reqs.length})</h3>
          <div className="list">{reqs.length ? reqs.map(r => <span key={r}>{nodeLink(r)}</span>) : <span className="muted">None</span>}</div>
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
            {order.map(k => <li key={k}>{nodeLink(k)}</li>)}
          </ol>
        </div>

        <div className="group">
          <h3>Awards</h3>
          <div className="list">{awards.length ? awards.map(a => <span key={a} className="item">{a}</span>) : <span className="muted">None</span>}</div>
        </div>

        <div className="group">
          <h3>Direct Unlocks ({unlocks.length})</h3>
          <div className="list">{unlocks.length ? unlocks.map(u => <span key={u}>{nodeLink(u)}</span>) : <span className="muted">None</span>}</div>
        </div>
      </>
    )
  } else {
    detailsContent = <div className="placeholder">{graph ? 'Select a node from the list.' : 'Load a graph, then search and select a node.'}</div>
  }

  return (
    <>
      <header>
        <h1>RiftBreaker Research Explorer</h1>
        <div className="controls">
          <input type="search" placeholder="Search by name or key..." value={search} onChange={e => setSearch(e.target.value)} />
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(([val, disp]) => <option key={val} value={val}>{disp}</option>)}
          </select>
          <span id="count">{filtered.length} results</span>
        </div>
      </header>
      <main>
        <aside>
          <ul id="results">
            {filtered.map(n => (
              <li key={n.key} className={n.key === activeKey ? 'active' : ''} onClick={() => setActiveKey(n.key)}>
                <div>{normalizeName(n)}</div>
              </li>
            ))}
          </ul>
        </aside>
        <section id="details">
          {detailsContent}
        </section>
      </main>
      {SHOW_TIP && (
        <footer>
          <small>
            Tip: Use analyze_research.ts to generate research_graph.json, and gui2lookup.ts to fill readable names.
          </small>
        </footer>
      )}
    </>
  )
}
