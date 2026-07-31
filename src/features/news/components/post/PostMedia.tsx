/* src/features/news/components/post/PostMedia.tsx
   Grille média mesurée par onLayout (pas de useWindowDimensions : sinon
   chaque rotation ou ouverture de clavier re-rend TOUTES les cartes du fil).

   Mises en page : 1 média plein cadre au ratio réel (clampé), 2 côte à côte,
   3 en « une + deux », 4+ en 2x2 avec overlay +N. Vidéo = aperçu 16/9. */

import { memo, useCallback, useState } from 'react'
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { getFeedImageUrl } from '@/lib/cloudinary'
import {
  MEDIA_GAP,
  MEDIA_VISIBLE_MAX,
  POST_MAX_WIDTH,
  postColors,
  postMotion,
  postRadius,
} from '../../theme/postTokens'
import type { NewsPostMedia } from '../../types'

/* Bornes du ratio d'une image seule : au-delà on rogne plutôt que de laisser
   un panorama de 12px de haut ou un portrait qui mange trois écrans. */
const MIN_RATIO = 0.72
const MAX_RATIO = 1.91

interface PostMediaProps {
  media: NewsPostMedia[]
  onOpenImage: (index: number) => void
  onOpenVideo: () => void
}

function thumb(item: NewsPostMedia, width: number): string {
  return (
    getFeedImageUrl(item.thumbnailUrl ?? item.url, Math.round(width)) ??
    item.url
  )
}

function Tile({
  item,
  width,
  height,
  index,
  overlayCount,
  onPress,
}: {
  item: NewsPostMedia
  width: number
  height: number
  index: number
  overlayCount?: number
  onPress: (index: number) => void
}) {
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={
        overlayCount
          ? `Voir les ${overlayCount + 1} médias restants`
          : `Agrandir le média ${index + 1}`
      }
      onPress={() => onPress(index)}
      style={({ pressed }) => [
        { width, height },
        styles.tile,
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: thumb(item, width * 2) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={postMotion.imageTransition}
        recyclingKey={item.url}
      />

      {overlayCount ? (
        <View style={styles.countOverlay}>
          <Text style={styles.countText}>+{overlayCount}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

function VideoPreview({
  item,
  width,
  onPress,
}: {
  item: NewsPostMedia
  width: number
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Lire la vidéo"
      onPress={onPress}
      style={({ pressed }) => [
        { width, height: Math.round((width * 9) / 16) },
        styles.tile,
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: thumb(item, width * 2) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={postMotion.imageTransition}
        recyclingKey={item.url}
      />

      <View style={styles.videoScrim}>
        <View style={styles.playButton}>
          <Ionicons name="play" size={26} color="#FFFFFF" />
        </View>
      </View>

      {item.duration ? (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {Math.floor(item.duration / 60)}:
            {String(Math.floor(item.duration % 60)).padStart(2, '0')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

function PostMediaComponent({ media, onOpenImage, onOpenVideo }: PostMediaProps) {
  const [width, setWidth] = useState(0)

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.min(event.nativeEvent.layout.width, POST_MAX_WIDTH)

    setWidth((previous) => (Math.abs(previous - next) > 1 ? next : previous))
  }, [])

  if (media.length === 0) return null

  return (
    <View onLayout={handleLayout} style={styles.container}>
      {width > 0 ? renderGrid(media, width, onOpenImage, onOpenVideo) : null}
    </View>
  )
}

function renderGrid(
  media: NewsPostMedia[],
  width: number,
  onOpenImage: (index: number) => void,
  onOpenVideo: () => void,
) {
  const [first] = media

  if (first.type === 'video') {
    return <VideoPreview item={first} width={width} onPress={onOpenVideo} />
  }

  if (media.length === 1) {
    const natural =
      first.width && first.height ? first.width / first.height : 1
    const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, natural))

    return (
      <Tile
        item={first}
        index={0}
        width={width}
        height={Math.round(width / ratio)}
        onPress={onOpenImage}
      />
    )
  }

  if (media.length === 2) {
    const cell = (width - MEDIA_GAP) / 2

    return (
      <View style={styles.row}>
        {media.map((item, index) => (
          <Tile
            key={`${item.url}-${index}`}
            item={item}
            index={index}
            width={cell}
            height={cell}
            onPress={onOpenImage}
          />
        ))}
      </View>
    )
  }

  if (media.length === 3) {
    const height = Math.round(width * 0.72)
    const main = Math.round((width - MEDIA_GAP) * 0.62)
    const side = width - MEDIA_GAP - main
    const sideCell = (height - MEDIA_GAP) / 2

    return (
      <View style={styles.row}>
        <Tile
          item={media[0]}
          index={0}
          width={main}
          height={height}
          onPress={onOpenImage}
        />
        <View style={styles.column}>
          {media.slice(1).map((item, offset) => (
            <Tile
              key={`${item.url}-${offset}`}
              item={item}
              index={offset + 1}
              width={side}
              height={sideCell}
              onPress={onOpenImage}
            />
          ))}
        </View>
      </View>
    )
  }

  const visible = media.slice(0, MEDIA_VISIBLE_MAX)
  const remaining = media.length - MEDIA_VISIBLE_MAX
  const cell = (width - MEDIA_GAP) / 2

  return (
    <View style={styles.grid}>
      {visible.map((item, index) => (
        <Tile
          key={`${item.url}-${index}`}
          item={item}
          index={index}
          width={cell}
          height={cell}
          overlayCount={
            index === MEDIA_VISIBLE_MAX - 1 && remaining > 0 ? remaining : undefined
          }
          onPress={onOpenImage}
        />
      ))}
    </View>
  )
}

export const PostMedia = memo(PostMediaComponent)

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: POST_MAX_WIDTH,
  },
  row: {
    flexDirection: 'row',
    gap: MEDIA_GAP,
  },
  column: {
    gap: MEDIA_GAP,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MEDIA_GAP,
  },
  tile: {
    overflow: 'hidden',
    backgroundColor: postColors.mediaPlaceholder,
  },
  pressed: {
    opacity: 0.88,
  },
  countOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrimHeavy,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
  },
  videoScrim: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrimLight,
  },
  playButton: {
    width: 58,
    height: 58,
    borderRadius: postRadius.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
    backgroundColor: postColors.scrim,
  },
  durationBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: postColors.scrim,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
})
