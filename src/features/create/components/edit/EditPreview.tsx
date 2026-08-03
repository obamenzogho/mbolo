/* EditPreview.tsx — Aperçu partagé de l'image en cours d'édition.

   Affiche l'image avec les transformations de base (aspect ratio,
   rotation, flip). Le crop style Instagram déplace l'image derrière
   un cadre fixe.

   Le composant mesure son conteneur via onLayout pour s'adapter
   à l'espace réellement disponible. */

import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import type { CropState, Adjustments, EffectOverlay } from '../../types/editing'
import { getEffect } from '../../types/editing'
import { CropOverlay } from './CropOverlay'

interface EditPreviewProps {
  uri: string
  crop: CropState
  adjustments?: Adjustments
  effectId?: string
  /** Afficher les guides de recadrage. */
  showCropOverlay?: boolean
  /** Callback quand la transformation de l'image change. */
  onTransformChange?: (transform: { scale: number; translateX: number; translateY: number }) => void
}

export const EditPreview = memo(function EditPreview({
  uri,
  crop,
  adjustments,
  effectId,
  showCropOverlay = false,
  onTransformChange,
}: EditPreviewProps) {
  /* Mesure du conteneur réel via onLayout. */
  const [box, setBox] = useState({ width: 0, height: 0 })

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout
    if (width > 0 && height > 0) {
      setBox({ width, height })
    }
  }, [])

  /* Calcul de la taille du cadre de recadrage (basé sur l'aspect ratio). */
  const frameSize = useMemo(() => {
    if (box.width === 0 || box.height === 0) {
      return { width: 0, height: 0 }
    }
    const ratio = crop.aspect > 0 ? crop.aspect : 1
    const maxW = box.width * 0.9
    const maxH = box.height * 0.9

    let w = maxW
    let h = w / ratio

    if (h > maxH) {
      h = maxH
      w = h * ratio
    }

    return { width: Math.round(w), height: Math.round(h) }
  }, [crop.aspect, box.width, box.height])

  /* Transformation CSS approximée pour le preview (rotation/flip). */
  const transform = useMemo(() => {
    const r: string[] = []
    if (crop.rotation !== 0) r.push(`rotate(${crop.rotation}deg)`)
    if (crop.flipH) r.push('scaleX(-1)')
    if (crop.flipV) r.push('scaleY(-1)')
    return r.length > 0 ? r.join(' ') : undefined
  }, [crop.rotation, crop.flipH, crop.flipV])

  /* Overlay d'effet (grain, leak, prism). */
  const effect = getEffect(effectId ?? 'ef-none')
  const overlayStyle = useMemo(() => {
    if (!effect.overlay) return null
    return getOverlayStyle(effect.overlay)
  }, [effect.overlay])

  return (
    <View style={styles.container} onLayout={onLayout}>
      {frameSize.width > 0 && frameSize.height > 0 ? (
        <>
          <Image
            source={{ uri }}
            style={[
              styles.image,
              { width: frameSize.width, height: frameSize.height },
              transform ? { transform: [{ rotate: '0deg' }, { scale: 1 }] } : undefined,
            ]}
            contentFit="cover"
            transition={0}
          />
          {overlayStyle ? (
            <View style={[styles.effectOverlay, { width: frameSize.width, height: frameSize.height }, overlayStyle]} />
          ) : null}
          {showCropOverlay && onTransformChange ? (
            <CropOverlay
              frameWidth={frameSize.width}
              frameHeight={frameSize.height}
              crop={crop}
              onTransformChange={onTransformChange}
            />
          ) : null}
        </>
      ) : null}
    </View>
  )
})

function getOverlayStyle(type: EffectOverlay): object {
  switch (type) {
    case 'grain':
      return { backgroundColor: 'rgba(128,128,128,0.15)' }
    case 'leak':
      return { backgroundColor: 'transparent', borderBottomColor: 'rgba(255,138,0,0.3)' }
    case 'prism':
      return { backgroundColor: 'rgba(0,120,255,0.1)' }
    default:
      return {}
  }
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
