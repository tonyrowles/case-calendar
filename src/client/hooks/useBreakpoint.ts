import { useEffect, useState } from 'react'

export type Tier = 'one' | 'two' | 'three'

function computeTier(w: number): Tier {
  if (w >= 1920) return 'three'
  if (w >= 1280) return 'two'
  return 'one'
}

export function useBreakpoint(): Tier {
  // SSR-safe initializer: guard window access so the hook doesn't throw in
  // Node/SSR environments. Falls back to 'one' (narrowest tier) when window
  // is not available. The useEffect below will correct the value after hydration.
  const [tier, setTier] = useState<Tier>(() =>
    typeof window !== 'undefined' ? computeTier(window.innerWidth) : 'one'
  )

  useEffect(() => {
    // Guard against jsdom / environments that do not implement matchMedia
    if (typeof window.matchMedia !== 'function') return
    const mqTwo = window.matchMedia('(min-width: 1280px)')
    const mqThree = window.matchMedia('(min-width: 1920px)')
    const update = () => setTier(computeTier(window.innerWidth))
    mqTwo.addEventListener('change', update)
    mqThree.addEventListener('change', update)
    return () => {
      mqTwo.removeEventListener('change', update)
      mqThree.removeEventListener('change', update)
    }
  }, [])

  return tier
}
