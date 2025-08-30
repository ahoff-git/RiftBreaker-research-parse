export default function Header({ title, children }) {
  return (
    <header>
      <h1>{title}</h1>
      {children ? <div className="controls">{children}</div> : null}
    </header>
  )
}
