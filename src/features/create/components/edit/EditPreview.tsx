/* EditPreview.tsx — Aperçu partagé de l'image en cours d'édition.

   Affiche l'image avec les transformations de base (aspect ratio,
   rotation, flip). Le crop style Instagram déplace l'image derrière
   un cadre fixe.

   Les filtres / effets / ajustements ne sont PAS approchés ici : le proxy
   (useEditPreviewProxy) rend une vraie miniature avec le même filterGraph
   que la publication, garantissant le WYSIWYG. `previewUri` est cette
   miniature ; `rendering` permet un voile discret pendant le rendu.

   La couche overlay (texte / stickers / dessin) est rendue dans une
   View transparente référencée par `overlayRef` : EditScreen la capture
   en PNG via react-native-view-shot pour la graver dans le fichier
   final avec FFmpeg. PAS de backgroundColor sur cette couche, sinon
   l'alpha est perdue et l'overlay masque toute l'image. */

import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import type { CropState, Adjustments, OverlayEl } from '../../types/editing'
import { CropOverlay } from './CropOverlay'

interface EditPreviewProps {
  uri: string
  /** Aperçu filtré (proxy FFmpeg). Défaut : l'image source. */
  previewUri?: string
  /** Rendu en cours — voile discret plutôt qu'un flash. */
  rendering?: boolean
  crop: CropState
  adjustments?: Adjustments
  /** Afficher les guides de recadrage. */
  showCropOverlay?: boolean
  /** Callback quand la transformation de l'image change. */
  onTransformChange?: (transform: { scale: number; translateX: number; translateY: number }) => void
  /** Overlays à afficher (texte / stickers / dessin). */
  overlay?: OverlayEl[]
  /** Ref de la couche overlay, remontée à EditScreen pour capture. */
  overlayRef?: React.RefObject<unknown>
}

export const EditPreview = memo(function EditPreview({
  uri,
  previewUri,
  rendering = false,
  crop,
  adjustments,
  showCropOverlay = false,
  onTransformChange,
  overlay,
  overlayRef,
}: EditPreviewProps) {
  const displayUri = previewUri ?? uri

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

  /* Position de la couche overlay : exactement sur l'image centrée. */
  const overlayFrame = useMemo(() => {
    if (box.width === 0 || frameSize.width === 0) return null
    return {
      left: (box.width - frameSize.width) / 2,
      top: (box.height - frameSize.height) / 2,
      width: frameSize.width,
      height: frameSize.height,
    }
  }, [box.width, box.height, frameSize])

  return (
    <View style={styles.container} onLayout={onLayout}>
      {frameSize.width > 0 && frameSize.height > 0 ? (
        <>
          <Image
            source={{ uri: displayUri }}
            style={[
              styles.image,
              { width: frameSize.width, height: frameSize.height },
              transform ? { transform: [{ rotate: '0deg' }, { scale: 1 }] } : undefined,
            ]}
            contentFit="cover"
            transition={0}
          />
          {showCropOverlay && onTransformChange ? (
            <CropOverlay
              frameWidth={frameSize.width}
              frameHeight={frameSize.height}
              crop={crop}
              onTransformChange={onTransformChange}
            />
          ) : null}

          {/* Couche overlay (texte / stickers / dessin) — capturée en
              PNG pour FFmpeg. Sans backgroundColor, collapsable désactivé. */}
          {overlayFrame && (overlay?.length ?? 0) > 0 ? (
            <View
              ref={overlayRef as React.RefObject<View>}
              collapsable={false}
              pointerEvents="auto"
              style={[styles.overlayLayer, overlayFrame]}
            >
              {overlay!.map((el) => (
                <OverlayElement key={el.id} el={el} frame={frameSize} />
              ))}
            </View>
          ) : null}

          {/* Voile discret pendant un rendu FFmpeg en cours. */}
          {rendering ? <View style={styles.veil} /> : null}
        </>
      ) : null}
    </View>
  )
})

/* ── Rendu d'un élément overlay (texte / sticker / dessin) ────────── */

function OverlayElement({ el, frame }: { el: OverlayEl; frame: { width: number; height: number } }) {
  if (el.kind === 'text') {
    const fontSize = Math.max(14, el.size * frame.width)
    return (
      <Text
        style={{
          position: 'absolute',
          left: el.x * frame.width,
          top: el.y * frame.height,
          color: el.color,
          fontSize,
          fontWeight: '700',
          transform: [
            { translateX: -fontSize * 0.3 },
            { translateY: -fontSize * 0.5 },
          ],
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowRadius: 2,
        }}
      >
        {el.text}
      </Text>
    )
  }

  if (el.kind === 'sticker') {
    const size = Math.max(20, el.scale * frame.width)
    return (
      <Text
        style={{
          position: 'absolute',
          left: el.x * frame.width - size / 2,
          top: el.y * frame.height - size / 2,
          fontSize: size,
        }}
      >
        {el.emoji}
      </Text>
    )
  }

  /* stroke : série de points le long du tracé. */
  if (el.kind === 'stroke') {
    const r = Math.max(2, el.size / 2)
    return (
      <>
        {el.points.map((p, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: p.x * frame.width - r,
              top: p.y * frame.height - r,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: el.color,
            }}
          />
        ))}
      </>
    )
  }

  return null
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
  overlayLayer: {
    position: 'absolute',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
})
