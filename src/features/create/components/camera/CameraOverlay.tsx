/* CameraOverlay.tsx — Overlays de la caméra studio.

   Trois couches rendues par-dessus CameraView :
   1. Grid of thirds (2×2 lignes de composition)
   2. Ratio mask (masque noir semi-transparent troué au ratio choisi)
   3. Zoom indicator (bulle centrale avec le facteur de zoom)

   Tous les overlays sont `pointerEvents="none"` pour ne pas intercepter
   les touches de la caméra. */

import { memo, useMemo } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'

interface CameraOverlayProps {
  /** Afficher la grille de composition. */
  showGrid: boolean
  /** Ratio d'aspect actuel. 'original' = pas de masque. */
  aspectRatio: '9:16' | '1:1' | '4:5' | '16:9' | 'original'
  /** Facteur de zoom actuel (1 = normal). */
  zoom: number
  /** Afficher l'indicateur de zoom. */
  showZoomIndicator: boolean
}

function CameraOverlayComponent({
  showGrid,
  aspectRatio,
  zoom,
  showZoomIndicator,
}: CameraOverlayProps) {
  const { width, height } = useWindowDimensions()

  /* ── Calcul du masque de ratio ─────────────────────────────────── */
  const mask = useMemo(() => {
    if (aspectRatio === 'original') return null

    const ratios: Record<string, number> = {
      '9:16': 9 / 16,
      '1:1': 1,
      '4:5': 4 / 5,
      '16:9': 16 / 9,
    }

    const targetRatio = ratios[aspectRatio]
    if (!targetRatio) return null

    /* Le masque troué est centré. On calcule la zone visible. */
    const screenHeight = height
    const screenWidth = width
    const screenRatio = screenWidth / screenHeight

    let visibleWidth: number
    let visibleHeight: number

    if (targetRatio > screenRatio) {
      /* Le ratio est plus large que l'écran → largeur = écran, hauteur calculée. */
      visibleWidth = screenWidth
      visibleHeight = screenWidth / targetRatio
    } else {
      /* Le ratio est plus haut que l'écran → hauteur = écran, largeur calculée. */
      visibleHeight = screenHeight
      visibleWidth = screenHeight * targetRatio
    }

    return {
      width: visibleWidth,
      height: visibleHeight,
      top: (screenHeight - visibleHeight) / 2,
      left: (screenWidth - visibleWidth) / 2,
    }
  }, [aspectRatio, width, height])

  return (
    <View style={styles.container} pointerEvents="none">
      {/* ── Grid of thirds ───────────────────────────────────────── */}
      {showGrid ? (
        <View style={styles.grid}>
          {/* Lignes horizontales */}
          <View style={[styles.gridLine, styles.gridLineH, { top: '33.33%' }]} />
          <View style={[styles.gridLine, styles.gridLineH, { top: '66.66%' }]} />
          {/* Lignes verticales */}
          <View style={[styles.gridLine, styles.gridLineV, { left: '33.33%' }]} />
          <View style={[styles.gridLine, styles.gridLineV, { left: '66.66%' }]} />
        </View>
      ) : null}

      {/* ── Ratio mask ──────────────────────────────────────────── */}
      {mask ? (
        <View style={styles.maskContainer}>
          {/* Bandeau haut */}
          <View style={[styles.maskBand, { height: mask.top, width }]} />
          {/* Bande gauche + zone visible + bande droite */}
          <View style={{ flexDirection: 'row', height: mask.height }}>
            <View style={[styles.maskBand, { width: mask.left, height: mask.height }]} />
            <View style={{ width: mask.width, height: mask.height }} />
            <View style={[styles.maskBand, { width: mask.left, height: mask.height }]} />
          </View>
          {/* Bandeau bas */}
          <View style={[styles.maskBand, { height: mask.top, width }]} />
        </View>
      ) : null}

      {/* ── Zoom indicator ──────────────────────────────────────── */}
      {showZoomIndicator && Math.abs(zoom - 1) > 0.05 ? (
        <View style={styles.zoomBubble}>
          <Text style={styles.zoomText}>{zoom.toFixed(1)}x</Text>
        </View>
      ) : null}
    </View>
  )
}

export const CameraOverlay = memo(CameraOverlayComponent)

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },

  /* Grid */
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  gridLineH: {
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  gridLineV: {
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },

  /* Ratio mask */
  maskContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  maskBand: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  /* Zoom indicator */
  zoomBubble: {
    position: 'absolute',
    bottom: 160,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  zoomText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
})
