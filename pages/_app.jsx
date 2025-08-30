import Head from 'next/head'
import '../styles/globals.css'
import { PRESS_KIT } from '../lib/pressKitAssets.mjs'

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="app-wrapper" style={{ '--background-image': `url(${PRESS_KIT.background})` }}>
        <Component {...pageProps} />
      </div>
    </>
  )
}
