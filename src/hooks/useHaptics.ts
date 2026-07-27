import { useCallback } from 'react'
import * as Haptics from 'expo-haptics'
import { useAppliedAccessibility } from '@/features/settings/appliedStore'

export function useHaptics() {
  // On lit le réglage via le store appliqué (synchrone, évite tout re-render
  // en cascade) plutôt que le context Settings : le hook est utilisé dans
  // beaucoup de composants (onglets, boutons…).
  const hapticsEnabled = useAppliedAccessibility((s) => s.hapticsEnabled)

  const lightImpact = useCallback(() => {
    if (!hapticsEnabled) return // respecte le réglage « Vibrations »
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch { /* haptics non essentiel */ }
  }, [hapticsEnabled])

  return { lightImpact }
}
