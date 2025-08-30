import { Fragment } from 'react'

const links = [
  { href: 'https://riftbreaker.fandom.com/wiki/The_Riftbreaker_Wiki', label: 'Wiki' },
  { href: 'https://www.riftbreaker.com/', label: 'Official Site' },
  { href: 'https://www.discord.gg/exorstudios', label: 'Discord' },
  { href: 'http://store.steampowered.com/app/780310/?utm_source=exor_channel&utm_medium=riftbreaker_website&utm_content=button', label: 'Steam' }
]

export default function Footer({ tip = null }) {
  return (
    <footer>
      <small>
        {links.map(({ href, label }, i) => (
          <Fragment key={href}>
            <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
            {i < links.length - 1 && ' · '}
          </Fragment>
        ))}
        {tip && <Fragment> · {tip}</Fragment>}
      </small>
    </footer>
  )
}
