import { useCallback } from 'react'
import * as Haptics from 'expo-haptics'

export function useHaptics() {
  const lightImpact = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch { /* haptics non essentiel */ }
  }, [])

  return { lightImpact }
}
