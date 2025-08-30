import { useState, useEffect } from 'react'

export const DEFAULT_GRAPH_URL = '/research_graph.json'

export function useGraph(url = DEFAULT_GRAPH_URL) {
  const [graph, setGraph] = useState(null)
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const data = await res.json()
        if (!cancelled) {
          setGraph(data)
          setNodes(Object.entries(data.nodes || {}).map(([k, v]) => ({ key: k, ...v })))
        }
      } catch (e) {
        if (!cancelled && e.name !== 'AbortError') {
          setError(e)
          console.error('Could not fetch research graph', e)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
      setLoading(false)
    }
  }, [url])

  return { graph, nodes, loading, error }
}
