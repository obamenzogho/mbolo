/* src/features/news/components/compose/VideoSharePreview.tsx
   Aperçu de la vidéo repartagée : même cadrage 16/9 que la carte du fil,
   pour que l'auteur voie exactement ce qui sera publié. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { HIT_SLOP, postColors, postMotion, postRadius, postSpacing, postType } from '../../theme/postTokens'
import type { NewsPostVideoShare } from '../../types'

interface VideoSharePreviewProps {
  video: NewsPostVideoShare
  onChange: () => void
  onRemove: () => void
}

function VideoSharePreviewBase({ video, onChange, onRemove }: VideoSharePreviewProps) {
  const { t } = useI18n()

  return (
    <View style={styles.block}>
      <Pressable
        onPress={onChange}
        accessibilityRole="button"
        accessibilityLabel={t.news.compose.videoSharePick}
        style={({ pressed }) => [styles.frame, pressed && styles.pressed]}
      >
        {video.sharedThumbnailURL ? (
          <Image
            source={{ uri: video.sharedThumbnailURL }}
            style={styles.thumb}
            contentFit="cover"
            transition={postMotion.imageTransition}
          />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Ionicons name="videocam-outline" size={26} color={postColors.textTertiary} />
          </View>
        )}

        <View style={styles.playBadge}>
          <Ionicons name="play" size={20} color={postColors.onMedia} />
        </View>
      </Pressable>

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {video.sharedUserName ?? t.news.compose.videoShareTitle}
        </Text>
        {video.originalDescription ? (
          <Text style={styles.caption} numberOfLines={2}>
            {video.originalDescription}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onRemove}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={t.news.compose.videoShareRemove}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Ionicons name="close" size={18} color={postColors.textSecondary} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.rowGap,
    marginHorizontal: postSpacing.gutter,
    marginBottom: postSpacing.blockBottom,
    padding: postSpacing.inlineGap,
    borderRadius: postRadius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: postColors.inputBorder,
    backgroundColor: postColors.surface,
  },
  frame: {
    width: 108,
    aspectRatio: 16 / 9,
    borderRadius: postRadius.input,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%', backgroundColor: postColors.mediaPlaceholder },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -17,
    marginLeft: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrim,
  },
  meta: { flex: 1, gap: 3 },
  title: { color: postColors.textPrimary, ...postType.composeOption },
  caption: { color: postColors.textSecondary, ...postType.meta },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const VideoSharePreview = memo(VideoSharePreviewBase)
