/* src/features/news/components/post/PostVideoShare.tsx

   Rendu d'un post « video_share » : une vidéo existante partagée dans le fil.
   Vignette 16/9 (sharedThumbnailURL) + bouton play + bandeau auteur. Le tap
   ouvre la vidéo dans le feed vidéo via son id (même route que le profil). */

import { memo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import {
  POST_MAX_WIDTH,
  postColors,
  postMotion,
  postSpacing,
} from '../../theme/postTokens'
import type { NewsPostVideoShare } from '../../types'

interface PostVideoShareProps {
  share: NewsPostVideoShare
  onPress: () => void
}

function PostVideoShareComponent({ share, onPress }: PostVideoShareProps) {
  const { t } = useI18n()
  const [errored, setErrored] = useState(false)
  const hasThumb = Boolean(share.sharedThumbnailURL) && !errored

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.news.compose.videoSharePlayA11y}
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.preview}>
        {hasThumb ? (
          <Image
            source={{ uri: share.sharedThumbnailURL }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={postMotion.imageTransition}
            recyclingKey={share.sharedVideoId}
            onError={() => setErrored(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <Ionicons name="videocam" size={30} color={postColors.textTertiary} />
          </View>
        )}

        <View style={styles.scrim}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={26} color={postColors.onMedia} />
          </View>
        </View>
      </View>

      {(share.sharedUserName || share.originalDescription) ? (
        <View style={styles.caption}>
          {share.sharedUserName ? (
            <Text style={styles.author} numberOfLines={1}>
              @{share.sharedUserName}
            </Text>
          ) : null}
          {share.originalDescription ? (
            <Text style={styles.description} numberOfLines={2}>
              {share.originalDescription}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}

export const PostVideoShare = memo(PostVideoShareComponent)

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: POST_MAX_WIDTH,
  },
  pressed: {
    opacity: postMotion.pressedOpacity,
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    backgroundColor: postColors.mediaPlaceholder,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrimLight,
  },
  playButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
    backgroundColor: postColors.scrim,
  },
  caption: {
    paddingHorizontal: postSpacing.gutter,
    paddingTop: postSpacing.inlineGap,
    gap: 2,
  },
  author: {
    color: postColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  description: {
    color: postColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
})
