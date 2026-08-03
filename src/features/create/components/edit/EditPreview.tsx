/* EditPreview.tsx — Aperçu partagé de l'image en cours d'édition.

   Affiche l'image avec les transformations de base (aspect ratio,
   rotation, flip). Les filtres/ajustements sont approximés par des
   overlays pour le preview ; l'application réelle se fait au moment
   de l'upload via expo-image-manipulator.

   Le composant mesure son conteneur via onLayout pour s'adapter
   à l'espace réellement disponible (pas une valeur fixe). */

import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import type { CropState, Adjustments, EffectOverlay } from '../../types/editing'
import { getEffect } from '../../types/editing'

interface EditPreviewProps {
  uri: string
  crop: CropState
  adjustments?: Adjustments
  effectId?: string
}

export const EditPreview = memo(function EditPreview({
  uri,
  crop,
  adjustments,
  effectId,
}: EditPreviewProps) {
  /* Mesure du conteneur réel via onLayout. */
  const [box, setBox] = useState({ width: 0, height: 0 })

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout
    if (width > 0 && height > 0) {
      setBox({ width, height })
    }
  }, [])

  /* Calcul de la taille de l'image en respectant l'aspect ratio
     et les limites du conteneur réel. */
  const { width, height } = useMemo(() => {
    if (box.width === 0 || box.height === 0) {
      return { width: 0, height: 0 }
    }
    const ratio = crop.aspect > 0 ? crop.aspect : 1 // fallback: carré si original
    const maxW = box.width
    const maxH = box.height
    let w = maxW
    let h = maxW / ratio
    if (h > maxH) {
      h = maxH
      w = maxH * ratio
    }
    return { width: Math.round(w), height: Math.round(h) }
  }, [crop.aspect, box.width, box.height])

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
    <View style={styles.container} onLayout={onLayout}>
      {width > 0 && height > 0 ? (
        <>
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
          {overlayStyle ? (
            <View style={[styles.effectOverlay, { width, height }, overlayStyle]} />
          ) : null}
        </>
      ) : null}
    </View>
  )
})

function getOverlayStyle(type: EffectOverlay): object {
  switch (type) {
    case 'grain':
      return {
        backgroundColor: 'rgba(128,128,128,0.15)',
      }
    case 'leak':
      return {
        backgroundColor: 'transparent',
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#171717',
    borderRadius: 4,
  },
  image: {
    borderRadius: 4,
  },
  effectOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
  },
})
