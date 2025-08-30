import { PRESS_KIT } from '../lib/pressKitAssets.mjs'

export default function Logo({ className = '' }) {
  return (
    <img src={PRESS_KIT.logo} alt="Riftbreaker logo" className={className} />
  )
}
