/* EditPreview.tsx — Aperçu partagé de l'image en cours d'édition.

   Affiche l'image avec les transformations de base (aspect ratio,
   rotation, flip). Les filtres/ajustements sont approximés par des
   overlays pour le preview ; l'application réelle se fait au moment
   de l'upload via expo-image-manipulator. */

import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import type { CropState, Adjustments, EffectOverlay } from '../../types/editing'
import { getEffect } from '../../types/editing'

interface EditPreviewProps {
  uri: string
  crop: CropState
  adjustments?: Adjustments
  effectId?: string
  /** Dimensions du conteneur parent (pour calculer l'aspect). */
  containerWidth: number
  containerHeight: number
}

export const EditPreview = memo(function EditPreview({
  uri,
  crop,
  adjustments,
  effectId,
  containerWidth,
  containerHeight,
}: EditPreviewProps) {
  /* Calcul de la taille de l'image en respectant l'aspect ratio. */
  const { width, height } = useMemo(() => {
    const ratio = crop.aspect > 0 ? crop.aspect : 1 // fallback: carré si original
    const maxW = containerWidth
    const maxH = containerHeight
    let w = maxW
    let h = maxW / ratio
    if (h > maxH) {
      h = maxH
      w = maxH * ratio
    }
    return { width: Math.round(w), height: Math.round(h) }
  }, [crop.aspect, containerWidth, containerHeight])

  /* Transformation CSS approximée pour le preview. */
  const transform = useMemo(() => {
    const r: string[] = []
    if (crop.rotation !== 0) r.push(`rotate(${crop.rotation}deg)`)
    if (crop.flipH) r.push('scaleX(-1)')
    if (crop.flipV) r.push('scaleY(-1)')
    return r.length > 0 ? r.join(' ') : undefined
  }, [crop.rotation, crop.flipH, crop.flipV])

  /* Overlay d'effet (grain, leak, prism) — approximation visuelle. */
  const effect = getEffect(effectId ?? 'ef-none')
  const overlayStyle = useMemo(() => {
    if (!effect.overlay) return null
    return getOverlayStyle(effect.overlay)
  }, [effect.overlay])

  return (
    <View style={[styles.container, { width, height }]}>
      <Image
        source={{ uri }}
        style={[
          styles.image,
          { width, height },
          transform ? { transform: [{ rotate: '0deg' }, { scale: 1 }] } : undefined,
        ]}
        contentFit="cover"
        transition={0}
      />

      {/* Overlay d'effet */}
      {overlayStyle ? (
        <View style={[styles.effectOverlay, { width, height }, overlayStyle]} />
      ) : null}
    </View>
  )
})

function getOverlayStyle(type: EffectOverlay): object {
  switch (type) {
    case 'grain':
      return {
        backgroundColor: 'rgba(128,128,128,0.15)',
        // Pas de vrai grain sans Skia — on approxime avec une texture
      }
    case 'leak':
      return {
        backgroundColor: 'transparent',
        // Gradient radial approximé
        borderBottomColor: 'rgba(255,138,0,0.3)',
      }
    case 'prism':
      return {
        backgroundColor: 'rgba(0,120,255,0.1)',
      }
    default:
      return {}
  }
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#171717',
  },
  image: {
    borderRadius: 4,
  },
  effectOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
  },
})
