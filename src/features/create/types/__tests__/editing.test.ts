/* editing.test.ts — Cycle du flash et validité des options vidéo.
   Le flash est un cycle fermé : chaque état mène au suivant, et un état
   stocké inconnu ne doit pas dérailler le cycle. */

import {
  FLASH_MODES,
  isVideoQualityOption,
  nextFlashMode,
} from '../editing'

describe('nextFlashMode', () => {
  it('cycle off → on → auto → off', () => {
    expect(nextFlashMode('off')).toBe('on')
    expect(nextFlashMode('on')).toBe('auto')
    expect(nextFlashMode('auto')).toBe('off')
  })

  it('le cycle est complet et sans doublon', () => {
    expect(FLASH_MODES).toEqual(['off', 'on', 'auto'])
    const seen = new Set(FLASH_MODES.map((mode) => nextFlashMode(mode)))
    expect(seen.size).toBe(FLASH_MODES.length)
  })
})

describe('isVideoQualityOption', () => {
  it('accepte les trois résolutions connues', () => {
    expect(isVideoQualityOption('720p')).toBe(true)
    expect(isVideoQualityOption('1080p')).toBe(true)
    expect(isVideoQualityOption('2160p')).toBe(true)
  })

  it('rejette une valeur inconnue ou d’un autre type', () => {
    expect(isVideoQualityOption('4k')).toBe(false)
    expect(isVideoQualityOption(1080)).toBe(false)
    expect(isVideoQualityOption(null)).toBe(false)
  })
})
