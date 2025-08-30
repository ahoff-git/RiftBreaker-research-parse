import { useState, useEffect } from 'react'

export const DEFAULT_GRAPH_URL = '/research_graph.json'

export function useGraph(url = DEFAULT_GRAPH_URL) {
  const [graph, setGraph] = useState(null)
  const [nodes, setNodes] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const data = await res.json()
        if (!cancelled) {
          setGraph(data)
          setNodes(Object.entries(data.nodes || {}).map(([k, v]) => ({ key: k, ...v })))
        }
      } catch (e) {
        console.error('Could not fetch research graph', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [url])

  return { graph, nodes }
}
