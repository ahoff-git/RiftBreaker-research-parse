
export default function GraphStatus({ loading, error, children }) {
  if (loading) return <div className="placeholder">Loading graph…</div>
  if (error) return <div className="placeholder">Could not load graph: {String(error.message || error)}</div>
  return <>{children}</>
}
