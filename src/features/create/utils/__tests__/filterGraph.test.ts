/* filterGraph.test.ts — Tests de la géométrie de recadrage FFmpeg.

   Chaque cas vérifie que buildFilterChain produit la bonne chaîne de filtres
   et les bonnes dimensions de sortie. Les tests échouent contre le code actuel
   pour les bugs connus (crop décentré après rotation, pan bloqué, etc.) */

import { buildFilterChain, needsRender } from '../filterGraph'
import type { CropState } from '../../types/editing'

const PORTRAIT = { width: 1080, height: 1920 } as const
const LANDSCAPE = { width: 1920, height: 1080 } as const

/** Helper pour construire un CropState avec des overrides. */
function crop(overrides: Record<string, unknown> = {}): CropState & Record<string, unknown> {
  return {
    aspect: 0,
    rotation: 0,
    straighten: 0,
    flipH: false,
    flipV: false,
    cropX: 0.5,
    cropY: 0.5,
    ...overrides,
  }
}

/* ── Géométrie de base ──────────────────────────────────────────── */

describe('buildFilterChain — géométrie', () => {
  it('Carré (aspect=1) sur portrait → crop centré à 0:420', () => {
    const r = buildFilterChain({ ...PORTRAIT, crop: crop({ aspect: 1 }), maxSize: 1080 })
    expect(r.chain).toBe('crop=1080:1080:0:420,format=yuv420p')
    expect(r.width).toBe(1080)
    expect(r.height).toBe(1080)
  })

  it('Original (aspect=0) → pas de crop, resize uniquement', () => {
    const r = buildFilterChain({ ...PORTRAIT, crop: crop(), maxSize: 1080 })
    expect(r.chain).not.toContain('crop=')
    expect(r.chain).toContain('scale=608:1080:flags=lanczos')
    expect(r.width).toBe(608)
    expect(r.height).toBe(1080)
  })

  it('Paysage (1.91) sur portrait → crop centré', () => {
    const r = buildFilterChain({ ...PORTRAIT, crop: crop({ aspect: 1.91 }), maxSize: 1080 })
    expect(r.chain).toContain('crop=')
    expect(r.width).toBe(1080)
    // cw=1080, ch=even(1080/1.91)=even(565.4)=566. max(1080,566)≤1080 → pas de resize.
    expect(r.height).toBe(566)
  })

  it('Format libre (1.5) sur portrait → utilise le ratio arbitraire', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ freeformAspect: 1.5 }),
      maxSize: 1080,
    })
    expect(r.chain).toContain('crop=1080:720:0:600')
    expect(r.width).toBe(1080)
    expect(r.height).toBe(720)
  })

  /* ── Rotation 90° + aspect (BUG : crop décentré) ─────────────── */

  it('Rotation 90° + Carré → crop centré à x=420 (PAS x=0)', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ aspect: 1, rotation: 90 }),
      maxSize: 1080,
    })
    // Après transpose: 1920×1080. Carré 1080×1080 centré: x = (1920-1080)/2 = 420
    expect(r.chain).toContain('transpose=1')
    expect(r.chain).toContain('crop=1080:1080:420:0')
    expect(r.width).toBe(1080)
    expect(r.height).toBe(1080)
  })

  it('Rotation 90° + Carré + pan X=50 → crop décalé à 370', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ aspect: 1, rotation: 90 }),
      cropTransform: { scale: 1, translateX: 50, translateY: 0 },
      maxSize: 1080,
    })
    // Canvas 1920×1080. Window 1080. px = 960-540-50 = 370. Clamp [0,840].
    expect(r.chain).toContain('crop=1080:1080:370:0')
  })

  it('Rotation 90° + Carré + zoom 2 → crop centré à 690:270', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ aspect: 1, rotation: 90 }),
      cropTransform: { scale: 2, translateX: 0, translateY: 0 },
      maxSize: 1080,
    })
    // Canvas 1920×1080. cw=540, ch=540.
    // px = 960-270=690, py = 540-270=270. Clamp: [0,1380] / [0,540].
    expect(r.chain).toContain('crop=540:540:690:270')
  })

  /* ── Flip ─────────────────────────────────────────────────────── */

  it('Flip H → hflip en tête de chaîne', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ flipH: true }),
      maxSize: 1080,
    })
    expect(r.chain).toMatch(/^hflip/)
  })

  it('Flip V + Carré → vflip puis crop centré', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ aspect: 1, flipV: true }),
      maxSize: 1080,
    })
    expect(r.chain).toContain('vflip')
    expect(r.chain).toContain('crop=1080:1080:0:420')
  })

  it('Flip H + Rotation 90° → hflip puis transpose', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ flipH: true, rotation: 90 }),
      maxSize: 1080,
    })
    const hflipIdx = r.chain.indexOf('hflip')
    const transposeIdx = r.chain.indexOf('transpose')
    expect(hflipIdx).toBeGreaterThanOrEqual(0)
    expect(transposeIdx).toBeGreaterThanOrEqual(0)
    expect(hflipIdx).toBeLessThan(transposeIdx)
  })

  /* ── Straighten (champ séparé) ────────────────────────────────── */

  it('Straighten 20° → scale + rotate + crop back (sans transpose)', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ straighten: 20 }),
      maxSize: 1080,
    })
    expect(r.chain).toContain('rotate=')
    expect(r.chain).toContain('scale=')
    expect(r.chain).not.toContain('transpose')
    // Canvas 1080×1920 inchangé, crop back aux mêmes dims
    expect(r.chain).toContain('crop=1080:1920')
  })

  it('Rotation 90° + straighten 20° → transpose AVANT straighten', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ rotation: 90, straighten: 20 }),
      maxSize: 1080,
    })
    const transposeIdx = r.chain.indexOf('transpose=1')
    const rotateIdx = r.chain.indexOf('rotate=')
    expect(transposeIdx).toBeGreaterThanOrEqual(0)
    expect(rotateIdx).toBeGreaterThanOrEqual(0)
    expect(transposeIdx).toBeLessThan(rotateIdx)
    // Canvas après transpose: 1920×1080 → crop back 1920×1080
    expect(r.chain).toContain('crop=1920:1080')
    // Resize: 1920 > 1080 → scale down. w=1080, h=even(607.5)=608
    expect(r.width).toBe(1080)
    expect(r.height).toBe(608)
  })

  it('Rotation 90° seule → transpose=1, redimensionné', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ rotation: 90 }),
      maxSize: 1080,
    })
    expect(r.chain).toContain('transpose=1')
    // Canvas après transpose: 1920×1080 → resize maxSize → 1080×608
    expect(r.width).toBe(1080)
    expect(r.height).toBe(608)
  })

  it('Rotation 180° → transpose×2', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ rotation: 180 }),
      maxSize: 1080,
    })
    expect(r.chain).toContain('transpose=1,transpose=1')
    // Canvas 1080×1920 → maxSize → 608×1080
    expect(r.width).toBe(608)
    expect(r.height).toBe(1080)
  })

  it('Rotation 270° → transpose=2, redimensionné', () => {
    const r = buildFilterChain({
      ...PORTRAIT,
      crop: crop({ rotation: 270 }),
      maxSize: 1080,
    })
    expect(r.chain).toContain('transpose=2')
    // Canvas après transpose: 1920×1080 → resize maxSize → 1080×608
    expect(r.width).toBe(1080)
    expect(r.height).toBe(608)
  })
})

/* ── needsRender ────────────────────────────────────────────────── */

describe('needsRender', () => {
  it('état par défaut → false', () => {
    expect(needsRender({ ...PORTRAIT })).toBe(false)
  })

  it('aspect > 0 → true', () => {
    expect(needsRender({ ...PORTRAIT, crop: crop({ aspect: 1 }) })).toBe(true)
  })

  it('rotation != 0 → true', () => {
    expect(needsRender({ ...PORTRAIT, crop: crop({ rotation: 90 }) })).toBe(true)
  })

  it('straighten != 0 → true', () => {
    expect(needsRender({ ...PORTRAIT, crop: crop({ straighten: 20 }) })).toBe(true)
  })

  it('flipH → true', () => {
    expect(needsRender({ ...PORTRAIT, crop: crop({ flipH: true }) })).toBe(true)
  })

  it('flipV → true', () => {
    expect(needsRender({ ...PORTRAIT, crop: crop({ flipV: true }) })).toBe(true)
  })

  it('filter != none → true', () => {
    expect(needsRender({ ...PORTRAIT, filterId: 'clarendon' })).toBe(true)
  })

  it('effect != none → true', () => {
    expect(needsRender({ ...PORTRAIT, effectId: 'ef-vintage' })).toBe(true)
  })

  it('overlayCount > 0 → true', () => {
    expect(needsRender({ ...PORTRAIT, overlayCount: 1 })).toBe(true)
  })

  it('adjustments modifié → true', () => {
    expect(needsRender({
      ...PORTRAIT,
      adjustments: {
        brightness: 0, contrast: 0, saturation: 0, warmth: 0,
        fade: 0, highlights: 0, shadows: 0, tint: 0,
        sharpen: 0, vignette: 50,
      },
    })).toBe(true)
  })

  it('seul pan/zoom modifié (sans aspect) → false', () => {
    expect(needsRender({
      ...PORTRAIT,
      crop: crop({ aspect: 0 }),
      cropTransform: { scale: 2, translateX: 100, translateY: 50 },
    })).toBe(false)
  })

  it('pan/zoom + aspect → true', () => {
    expect(needsRender({
      ...PORTRAIT,
      crop: crop({ aspect: 1 }),
      cropTransform: { scale: 2, translateX: 100, translateY: 50 },
    })).toBe(true)
  })
})
