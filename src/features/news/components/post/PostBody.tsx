/* src/features/news/components/post/PostBody.tsx
   Texte du post : variante « hero » sur fond dégradé (texte seul, sans média)
   ou variante inline avec repli au-delà de POST_TEXT_LIMIT. Plus le lieu. */

import { memo, useMemo, useState } from 'react'
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import RichPostText from '../RichPostText'
import {
  POST_TEXT_LIMIT,
  postColors,
  postMotion,
  postSpacing,
  postType,
} from '../../theme/postTokens'
import { POST_BACKGROUNDS } from '../../types'
import type { NewsPost } from '../../types'

interface PostBodyProps {
  post: NewsPost
}

/* Coupe sur la dernière frontière de mot pour éviter « ...bonj » */
function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text

  const slice = text.slice(0, limit)
  const lastSpace = slice.lastIndexOf(' ')

  return `${slice.slice(0, lastSpace > limit * 0.7 ? lastSpace : limit).trimEnd()}…`
}

function PostBodyComponent({ post }: PostBodyProps) {
  const [expanded, setExpanded] = useState(false)

  const hasText = post.text.trim().length > 0
  const isHero =
    hasText &&
    !!post.background &&
    post.background !== 'none' &&
    post.media.length === 0

  const background = useMemo(
    () =>
      POST_BACKGROUNDS.find((item) => item.id === post.background) ??
      POST_BACKGROUNDS[0],
    [post.background],
  )

  const overflows = post.text.length > POST_TEXT_LIMIT
  const visibleText = expanded ? post.text : truncate(post.text, POST_TEXT_LIMIT)

  const toggle = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(180, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity),
      )
    }

    setExpanded((previous) => !previous)
  }

  return (
    <>
      {isHero ? (
        <LinearGradient
          colors={background.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroText} numberOfLines={8}>
            {post.text}
          </Text>
        </LinearGradient>
      ) : hasText ? (
        <View style={styles.textBlock}>
          <RichPostText text={visibleText} style={styles.bodyText} />

          {overflows ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                expanded ? 'Réduire la publication' : 'Afficher la publication entière'
              }
              onPress={toggle}
              style={({ pressed }) => [styles.moreLink, pressed && styles.pressed]}
            >
              <Text style={styles.moreLinkText}>
                {expanded ? 'Voir moins' : 'Voir plus'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {post.location ? (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={postColors.accent} />
          <Text style={styles.locationText} numberOfLines={1}>
            {post.location.name}
          </Text>
        </View>
      ) : null}
    </>
  )
}

export const PostBody = memo(PostBodyComponent)

const styles = StyleSheet.create({
  hero: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  heroText: {
    ...postType.bodyHero,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  textBlock: {
    paddingBottom: postSpacing.blockBottom,
  },
  bodyText: {
    ...postType.body,
    color: postColors.textPrimary,
    paddingHorizontal: postSpacing.gutter,
  },
  moreLink: {
    alignSelf: 'flex-start',
    paddingHorizontal: postSpacing.gutter,
    paddingTop: 6,
  },
  moreLinkText: {
    ...postType.link,
    color: postColors.textSecondary,
  },
  pressed: {
    opacity: postMotion.pressedOpacity,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: postSpacing.gutter,
    paddingBottom: postSpacing.blockBottom,
  },
  locationText: {
    ...postType.link,
    fontSize: 13,
    color: postColors.accent,
  },
})
