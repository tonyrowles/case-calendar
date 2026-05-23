import { useEffect, useState } from 'react'

export type Tier = 'one' | 'two' | 'three'

function computeTier(w: number): Tier {
  if (w >= 1920) return 'three'
  if (w >= 1280) return 'two'
  return 'one'
}

export function useBreakpoint(): Tier {
  const [tier, setTier] = useState<Tier>(() => computeTier(window.innerWidth))

  useEffect(() => {
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
