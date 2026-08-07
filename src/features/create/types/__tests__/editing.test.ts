/* editing.test.ts — Cycle du flash, validité des options vidéo et presets
   de zoom rapide. Le flash est un cycle fermé : chaque état mène au
   suivant, et un état stocké inconnu ne doit pas dérailler le cycle. */

import {
  FLASH_MODES,
  isVideoQualityOption,
  nextFlashMode,
  ZOOM_PRESETS,
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

describe('ZOOM_PRESETS', () => {
  it('couvre la plage de zoom d’expo-camera (0..1) sans chevauchement', () => {
    expect(ZOOM_PRESETS[0]).toEqual({ label: '1x', zoom: 0 })
    expect(ZOOM_PRESETS[ZOOM_PRESETS.length - 1].zoom).toBeLessThanOrEqual(1)
    const zooms = ZOOM_PRESETS.map((preset) => preset.zoom)
    expect(new Set(zooms).size).toBe(zooms.length)
  })

  it('chaque preset a un label non vide', () => {
    for (const preset of ZOOM_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0)
    }
  })
})
