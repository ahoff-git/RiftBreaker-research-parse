import { useRouter } from 'next/router'
import { useState, useEffect, useCallback, useRef } from 'react'

function firstString(query, names) {
  for (const n of names) {
    const v = query[n]
    if (typeof v === 'string') return v
  }
  return ''
}

// Hook to sync a state value with URL query parameters
// `names` can be a single name or array of names (aliases). The first name is used when updating the URL.
export function useUrlState(names, { defaultValue = '', method = 'replace' } = {}) {
  const router = useRouter()
  const namesRef = useRef(Array.isArray(names) ? names : [names])
  const paramNames = namesRef.current
  const primary = paramNames[0]

  const [value, setValue] = useState(() =>
    firstString(router.query || {}, paramNames) || defaultValue
  )

  useEffect(() => {
    setValue(firstString(router.query || {}, paramNames) || defaultValue)
  }, [router.query, defaultValue])

  const update = useCallback((v, opts = {}) => {
    setValue(v)
    const { method: m = method } = opts
    const query = { ...router.query }
    for (const n of paramNames) delete query[n]
    if (v != null && v !== '') query[primary] = v
    const fn = m === 'push' ? router.push : router.replace
    fn({ pathname: router.pathname, query }, undefined, { shallow: true })
  }, [router, method])

  return [value, update]
}

