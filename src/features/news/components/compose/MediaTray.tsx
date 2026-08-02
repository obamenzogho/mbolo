/* src/features/news/components/compose/MediaTray.tsx
   Aperçu des médias sélectionnés. Une vidéo occupe toute la largeur en 16/9,
   les photos défilent en vignettes carrées : c'est la forme qu'aura la
   publication, l'aperçu doit la préfigurer. */

import { memo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { COMPOSE_MAX_MEDIA, HIT_SLOP, postColors, postMotion, postRadius, postSpacing, postType } from '../../theme/postTokens'
import type { SelectedMedia } from '../../hooks/useComposeState'

interface MediaTrayProps {
  media: SelectedMedia[]
  onRemove: (uri: string) => void
  onAddMore: () => void
}

function RemoveButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
    >
      <Ionicons name="close" size={15} color={postColors.onMedia} />
    </Pressable>
  )
}

function MediaTrayBase({ media, onRemove, onAddMore }: MediaTrayProps) {
  const { t } = useI18n()

  if (media.length === 0) return null

  const video = media[0].type === 'video' ? media[0] : null

  if (video) {
    return (
      <View style={styles.videoBlock}>
        <Image
          source={{ uri: video.thumbnailUri ?? video.uri }}
          style={styles.videoPreview}
          contentFit="cover"
          transition={postMotion.imageTransition}
        />
        <View style={styles.playBadge}>
          <Ionicons name="play" size={22} color={postColors.onMedia} />
        </View>
        <RemoveButton onPress={() => onRemove(video.uri)} label={t.news.compose.mediaRemove} />
      </View>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {media.map((item) => (
        <View key={item.uri} style={styles.cell}>
          <Image
            source={{ uri: item.uri }}
            style={styles.thumb}
            contentFit="cover"
            transition={postMotion.imageTransition}
          />
          <RemoveButton onPress={() => onRemove(item.uri)} label={t.news.compose.mediaRemove} />
        </View>
      ))}

      {media.length < COMPOSE_MAX_MEDIA ? (
        <Pressable
          onPress={onAddMore}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.mediaAdd}
          style={({ pressed }) => [styles.cell, styles.add, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={26} color={postColors.textSecondary} />
          <Text style={styles.addText}>{`${media.length}/${COMPOSE_MAX_MEDIA}`}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  videoBlock: {
    marginHorizontal: postSpacing.gutter,
    marginBottom: postSpacing.blockBottom,
    borderRadius: postRadius.input,
    overflow: 'hidden',
    backgroundColor: postColors.mediaPlaceholder,
  },
  videoPreview: { width: '100%', aspectRatio: 16 / 9 },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -24,
    marginLeft: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrim,
  },
  strip: {
    gap: postSpacing.inlineGap,
    paddingHorizontal: postSpacing.gutter,
    paddingBottom: postSpacing.blockBottom,
  },
  cell: {
    width: 96,
    height: 96,
    borderRadius: postRadius.input,
    overflow: 'hidden',
    backgroundColor: postColors.mediaPlaceholder,
  },
  thumb: { width: '100%', height: '100%' },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: postColors.dropzoneBorder,
    backgroundColor: 'transparent',
  },
  addText: { color: postColors.textTertiary, ...postType.composeCounter },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrim,
  },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const MediaTray = memo(MediaTrayBase)
