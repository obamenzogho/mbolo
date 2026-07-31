/* src/features/news/components/post/PostBody.tsx
   Texte du post : variante « hero » sur fond dégradé (texte seul, sans média)
   ou variante inline avec repli au-delà de POST_TEXT_LIMIT.
   L'état d'expansion est possédé par l'écran (survit au recyclage des cartes) ;
   ce composant ne fait que le refléter et remonter le toggle. */

import { memo, useMemo } from 'react'
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useI18n } from '@/i18n'
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
  /** Dépliée ou repliée (état possédé par l'écran). */
  expanded?: boolean
  onToggleExpanded?: () => void
}

/* Coupe sur la dernière frontière de mot pour éviter « ...bonj » */
function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text

  const slice = text.slice(0, limit)
  const lastSpace = slice.lastIndexOf(' ')

  return `${slice.slice(0, lastSpace > limit * 0.7 ? lastSpace : limit).trimEnd()}…`
}

function PostBodyComponent({
  post,
  expanded = false,
  onToggleExpanded,
}: PostBodyProps) {
  const { t } = useI18n()

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

  const toggle = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(180, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity),
      )
    }

    onToggleExpanded?.()
  }

  const expandLink = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        expanded ? t.news.a11yCollapsePost : t.news.a11yExpandPost
      }
      onPress={toggle}
      style={({ pressed }) => [
        styles.moreLink,
        isHero && styles.heroMoreLink,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.moreLinkText}>
        {expanded ? t.news.seeLess : t.news.seeMore}
      </Text>
    </Pressable>
  )

  return (
    <>
      {isHero ? (
        <>
          <LinearGradient
            colors={background.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroText} numberOfLines={expanded ? undefined : 8}>
              {post.text}
            </Text>
          </LinearGradient>
          {overflows ? expandLink : null}
        </>
      ) : hasText ? (
        <View style={styles.textBlock}>
          <RichPostText
            text={expanded ? post.text : truncate(post.text, POST_TEXT_LIMIT)}
            style={styles.bodyText}
          />

          {overflows ? expandLink : null}
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
    color: postColors.onMedia,
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
  heroMoreLink: {
    paddingBottom: postSpacing.blockBottom,
  },
  moreLinkText: {
    ...postType.link,
    color: postColors.textSecondary,
  },
  pressed: {
    opacity: postMotion.pressedOpacity,
  },
})
