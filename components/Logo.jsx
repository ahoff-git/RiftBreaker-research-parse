import { PRESS_KIT } from '../lib/pressKitAssets.mjs'

export default function Logo({ className = '', size = 48 }) {
  return (
    <img
      src={PRESS_KIT.logo}
      alt="Riftbreaker logo"
      className={className}
      style={{ height: size, width: 'auto' }}
    />
  )
}
