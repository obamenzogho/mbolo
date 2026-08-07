/* src/features/news/components/post/PostMedia.tsx
   Grille média mesurée par onLayout (pas de useWindowDimensions : sinon
   chaque rotation ou ouverture de clavier re-rend TOUTES les cartes du fil).

   Mises en page : 1 média plein cadre au ratio réel (clampé), 2 côte à côte
   au ratio du premier visuel, 3 en « une + deux », 4+ en 2x2 avec overlay +N.
   Vidéo = aperçu 16/9.
   Chaque tuile gère ses états de chargement / erreur (TileImage). */

import { memo, useCallback, useState } from 'react'
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Image, type ImageContentFit } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { getFeedImageUrl } from '@/lib/cloudinary'
import { ShimmerBlock } from '../Skeletons'
import { interpolate } from '../../utils/format'
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

interface MediaLabels {
  openMedia: string
  mediaMore: string
  videoPlay: string
}

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

type ImageStatus = 'loading' | 'loaded' | 'error'

/* Image avec états explicites : fond placeholder + OrbitLoader pendant le
   chargement, icône cassée si le téléchargement échoue. */
function TileImage({
  uri,
  contentFit,
  transition,
  recyclingKey,
}: {
  uri: string
  contentFit: ImageContentFit
  transition: number
  recyclingKey: string
}) {
  const [status, setStatus] = useState<ImageStatus>('loading')

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        transition={transition}
        recyclingKey={recyclingKey}
        blurRadius={status === 'loading' ? 18 : 0}
        onLoadStart={() => setStatus('loading')}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />

      {/* Voile couleur qui s'estompe au chargement — effet blur-up FB */}
      {status === 'loading' ? (
        <ShimmerBlock style={styles.loadingShimmer} />
      ) : null}

      {status === 'error' ? (
        <View style={styles.errorOverlay}>
          <Ionicons
            name="image-outline"
            size={26}
            color={postColors.textTertiary}
          />
        </View>
      ) : null}
    </View>
  )
}

function Tile({
  item,
  width,
  height,
  index,
  overlayCount,
  labels,
  isVideo,
  onPress,
}: {
  item: NewsPostMedia
  width: number
  height: number
  index: number
  overlayCount?: number
  labels: MediaLabels
  isVideo?: boolean
  onPress: (index: number) => void
}) {
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={
        overlayCount
          ? interpolate(labels.mediaMore, overlayCount)
          : interpolate(labels.openMedia, index + 1)
      }
      onPress={() => onPress(index)}
      style={({ pressed }) => [
        { width, height },
        styles.tile,
        pressed && styles.pressed,
      ]}
    >
      <TileImage
        uri={thumb(item, width * 2)}
        contentFit="cover"
        transition={postMotion.imageTransition}
        recyclingKey={item.url}
      />

      {isVideo ? (
        <View style={styles.videoScrim}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={26} color={postColors.onMedia} />
          </View>
        </View>
      ) : null}

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
  labels,
  onPress,
}: {
  item: NewsPostMedia
  width: number
  labels: MediaLabels
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={labels.videoPlay}
      onPress={onPress}
      style={({ pressed }) => [
        { width, height: Math.round((width * 9) / 16) },
        styles.tile,
        pressed && styles.pressed,
      ]}
    >
      <TileImage
        uri={thumb(item, width * 2)}
        contentFit="cover"
        transition={postMotion.imageTransition}
        recyclingKey={item.url}
      />

      <View style={styles.videoScrim}>
        <View style={styles.playButton}>
          <Ionicons name="play" size={26} color={postColors.onMedia} />
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

/* Ratio effectif d'une tuile à partir des dimensions naturelles du visuel. */
function naturalRatio(item: NewsPostMedia): number {
  if (!item.width || !item.height) return 1

  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, item.width / item.height))
}

function PostMediaComponent({ media, onOpenImage, onOpenVideo }: PostMediaProps) {
  const { t } = useI18n()
  const [width, setWidth] = useState(0)

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.min(event.nativeEvent.layout.width, POST_MAX_WIDTH)

    setWidth((previous) => (Math.abs(previous - next) > 1 ? next : previous))
  }, [])

  const labels: MediaLabels = {
    openMedia: t.news.a11yMediaOpen,
    mediaMore: t.news.a11yMediaMore,
    videoPlay: t.news.a11yVideoPlay,
  }

  if (media.length === 0) return null

  return (
    <View onLayout={handleLayout} style={styles.container}>
      {width > 0
        ? renderGrid(media, width, labels, onOpenImage, onOpenVideo)
        : null}
    </View>
  )
}

function renderGrid(
  media: NewsPostMedia[],
  width: number,
  labels: MediaLabels,
  onOpenImage: (index: number) => void,
  onOpenVideo: () => void,
) {
  const [first] = media

  /* Un carrousel 100 % vidéo : grille de vignettes avec badge play (la
     lecture se fait dans la galerie). Une vidéo seule garde son aperçu
     16/9 dédié. */
  if (first.type === 'video' && media.length === 1) {
    return <VideoPreview item={first} width={width} labels={labels} onPress={onOpenVideo} />
  }

  if (media.length === 1) {
    return (
      <Tile
        item={first}
        index={0}
        width={width}
        height={Math.round(width / naturalRatio(first))}
        labels={labels}
        onPress={onOpenImage}
      />
    )
  }

  if (media.length === 2) {
    const cell = (width - MEDIA_GAP) / 2
    const height = Math.round(cell / naturalRatio(first))

    return (
      <View style={styles.row}>
        {media.map((item, index) => (
          <Tile
            key={`${item.url}-${index}`}
            item={item}
            index={index}
            width={cell}
            height={height}
            isVideo={item.type === 'video'}
            labels={labels}
            onPress={onOpenImage}
          />
        ))}
      </View>
    )
  }

  if (media.length === 3) {
    const height = Math.round(width / naturalRatio(first))
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
          isVideo={media[0].type === 'video'}
          labels={labels}
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
              isVideo={item.type === 'video'}
              labels={labels}
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
          isVideo={item.type === 'video'}
          overlayCount={
            index === MEDIA_VISIBLE_MAX - 1 && remaining > 0 ? remaining : undefined
          }
          labels={labels}
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
  loadingShimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: postColors.surfaceRaised,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.mediaPlaceholder,
  },
  countOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrimHeavy,
  },
  countText: {
    color: postColors.onMedia,
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
    color: postColors.onMedia,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
})
