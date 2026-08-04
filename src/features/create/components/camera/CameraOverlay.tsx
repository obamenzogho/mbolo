/* CameraOverlay.tsx — Overlays de la caméra studio.

   Deux couches rendues par-dessus CameraView :
   1. Grid of thirds (2×2 lignes de composition)
   2. Ratio mask (masque noir semi-transparent troué au ratio choisi)

   Tous les overlays sont `pointerEvents="none"` pour ne pas intercepter
   les touches de la caméra. Le zoom n'a pas d'indicateur : il est géré
   nativement par expo-camera (`isPinchToZoomEnabled`), qui n'expose pas
   le facteur courant. */

import { memo, useMemo } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { cameraColors } from '../../theme/createTokens'
import type { AspectRatioValue } from '../../types/editing'
import { ASPECT_RATIOS } from '../../types/editing'

interface CameraOverlayProps {
  /** Afficher la grille de composition. */
  showGrid: boolean
  /** Ratio d'aspect actuel. 'original' = pas de masque. */
  aspectRatio: AspectRatioValue
}

function CameraOverlayComponent({ showGrid, aspectRatio }: CameraOverlayProps) {
  const { width, height } = useWindowDimensions()

  /* ── Calcul du masque de ratio ─────────────────────────────────── */
  const mask = useMemo(() => {
    /* ratio 0 = 'original' : le cadre suit l'écran, aucun masque à poser. */
    const targetRatio = ASPECT_RATIOS.find((r) => r.value === aspectRatio)?.ratio ?? 0
    if (targetRatio <= 0) return null

    const screenRatio = width / height

    /* Le cadre visible est centré et inscrit dans l'écran : on borne par
       la largeur si le ratio est plus large que l'écran, par la hauteur sinon. */
    const visibleWidth = targetRatio > screenRatio ? width : height * targetRatio
    const visibleHeight = targetRatio > screenRatio ? width / targetRatio : height

    return {
      width: visibleWidth,
      height: visibleHeight,
      bandHeight: (height - visibleHeight) / 2,
      bandWidth: (width - visibleWidth) / 2,
    }
  }, [aspectRatio, width, height])

  return (
    <View style={styles.container} pointerEvents="none">
      {/* ── Grid of thirds ───────────────────────────────────────── */}
      {showGrid ? (
        <View style={styles.grid}>
          {/* Lignes horizontales */}
          <View style={[styles.gridLine, styles.gridLineH, styles.gridFirstThird]} />
          <View style={[styles.gridLine, styles.gridLineH, styles.gridSecondThirdH]} />
          {/* Lignes verticales */}
          <View style={[styles.gridLine, styles.gridLineV, styles.gridFirstThirdV]} />
          <View style={[styles.gridLine, styles.gridLineV, styles.gridSecondThirdV]} />
        </View>
      ) : null}

      {/* ── Ratio mask ──────────────────────────────────────────── */}
      {mask ? (
        <View style={styles.maskContainer}>
          {/* Bandeau haut */}
          <View style={[styles.maskBand, { height: mask.bandHeight }]} />
          {/* Bande gauche + zone visible + bande droite */}
          <View style={[styles.maskRow, { height: mask.height }]}>
            <View style={[styles.maskBand, { width: mask.bandWidth }]} />
            <View style={{ width: mask.width }} />
            <View style={[styles.maskBand, { width: mask.bandWidth }]} />
          </View>
          {/* Bandeau bas */}
          <View style={[styles.maskBand, { height: mask.bandHeight }]} />
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
    backgroundColor: cameraColors.gridLine,
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
  gridFirstThird: { top: '33.33%' },
  gridSecondThirdH: { top: '66.66%' },
  gridFirstThirdV: { left: '33.33%' },
  gridSecondThirdV: { left: '66.66%' },

  /* Ratio mask */
  maskContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  maskRow: {
    flexDirection: 'row',
  },
  maskBand: {
    backgroundColor: cameraColors.ratioMask,
  },
})
