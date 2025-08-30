import Logo from './Logo.jsx'

export default function Header({ title, children }) {
  return (
    <header>
      <div className="logo-title">
        <Logo className="logo" />
        <h1>{title}</h1>
      </div>
      {children ? <div className="controls">{children}</div> : null}
    </header>
  )
}
