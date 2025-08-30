import { useRouter } from 'next/router'
import { useGraph } from '../lib/useGraph.mjs'
import { normalizeName } from '../lib/graphUtils.mjs'

export default function NodeLink({ nodeKey, label, onClick }) {
  const { graph } = useGraph()
  const router = useRouter()

  const n = graph && graph.nodes && graph.nodes[nodeKey]
  const displayLabel = label || (n && (n.name || normalizeName({ key: nodeKey })) || nodeKey.split('/').pop())
  const href = `/?key=${encodeURIComponent(nodeKey)}`

  const handleClick = e => {
    e.preventDefault()
    router.push({ pathname: '/', query: { key: nodeKey } }, undefined, { shallow: true })
    if (onClick) onClick(nodeKey)
  }

  return (
    <a href={href} className="item" onClick={handleClick}>
      {displayLabel}
    </a>
  )
}
