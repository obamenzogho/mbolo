import { create } from 'zustand'
import type { TextSize } from './types'

/**
 * Miroir léger, lisible de façon synchrone hors React, des réglages qui doivent
 * influencer des primitives bas niveau (animations de page, échelle de texte,
 * haptics). Le SettingsProvider est seul responsable de le tenir à jour depuis
 * le doc Firestore synchronisé. On évite ainsi re-renders en cascade et cycles
 * d'import (useHaptics/usePageAnimation ne dépendent pas du context React).
 */

const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.9,
  default: 1,
  large: 1.15,
  xlarge: 1.3,
}

interface AppliedAccessibility {
  reduceMotion: boolean
  textScale: number
  highContrast: boolean
  hapticsEnabled: boolean
  setFromSettings: (a: {
    reduceMotion: boolean
    textSize: TextSize
    highContrast: boolean
    hapticsEnabled: boolean
  }) => void
}

export const useAppliedAccessibility = create<AppliedAccessibility>()((set) => ({
  reduceMotion: false,
  textScale: 1,
  highContrast: false,
  hapticsEnabled: true,
  setFromSettings: ({ reduceMotion, textSize, highContrast, hapticsEnabled }) =>
    set({ reduceMotion, textScale: TEXT_SCALE[textSize] ?? 1, highContrast, hapticsEnabled }),
}))

/** Accès synchrone hors composant (ex. dans un worklet-safe JS thread). */
export function getReduceMotion(): boolean {
  return useAppliedAccessibility.getState().reduceMotion
}
