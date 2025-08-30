import { useMemo } from 'react'

/**
 * Derive sorted category/value pairs from a graph object or array of nodes.
 * @param {object|Array} source - Graph with .nodes or array of node objects
 * @returns {Array<[string, string]>} Array of [value, display] pairs sorted by display
 */
export function deriveCategories(source) {
  let nodes = []
  if (Array.isArray(source)) {
    nodes = source
  } else if (source && source.nodes) {
    nodes = Array.isArray(source.nodes) ? source.nodes : Object.values(source.nodes)
  }
  const cats = new Map()
  for (const n of nodes) {
    if (n && n.category) {
      const disp = n.categoryName || n.category
      if (!cats.has(n.category)) cats.set(n.category, disp)
    }
  }
  return Array.from(cats.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1])))
}

/**
 * React hook returning sorted category pairs derived from a graph or nodes array.
 * @param {object|Array} source - Graph with .nodes or array of nodes
 */
export function useCategories(source) {
  return useMemo(() => deriveCategories(source), [source])
}

