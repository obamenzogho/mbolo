/* src/features/news/components/post/PostCardSkeleton.tsx
   Remplace le loader plein écran au premier chargement : la structure du fil
   apparaît immédiatement, la perception de latence chute.
   Pulsation d'opacité uniquement (propriété non-layout, driver natif). */

import { memo, useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { postColors, postRadius, postSpacing } from '../../theme/postTokens'

function Shimmer({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 720,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 720,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )

    loop.start()

    return () => loop.stop()
  }, [opacity])

  return <Animated.View style={[styles.block, style, { opacity }]} />
}

function PostCardSkeletonComponent({ withMedia = true }: { withMedia?: boolean }) {
  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.header}>
        <Shimmer style={styles.avatar} />
        <View style={styles.identity}>
          <Shimmer style={styles.lineName} />
          <Shimmer style={styles.lineMeta} />
        </View>
      </View>

      <View style={styles.body}>
        <Shimmer style={styles.lineFull} />
        <Shimmer style={styles.lineFull} />
        <Shimmer style={styles.lineShort} />
      </View>

      {withMedia ? <Shimmer style={styles.media} /> : null}

      <View style={styles.footer}>
        <Shimmer style={styles.chip} />
        <Shimmer style={styles.chip} />
        <Shimmer style={styles.chip} />
      </View>
    </View>
  )
}

export const PostCardSkeleton = memo(PostCardSkeletonComponent)

/** Placeholder du fil complet, densités alternées pour éviter l'effet peigne. */
export function NewsFeedSkeleton() {
  return (
    <View>
      <PostCardSkeleton withMedia />
      <PostCardSkeleton withMedia={false} />
      <PostCardSkeleton withMedia />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: postColors.surface,
    borderBottomWidth: postSpacing.cardGap,
    borderBottomColor: postColors.canvas,
    paddingBottom: 14,
  },
  block: {
    backgroundColor: postColors.surfaceRaised,
    borderRadius: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.rowGap,
    paddingHorizontal: postSpacing.gutter,
    paddingTop: postSpacing.headerTop,
    paddingBottom: postSpacing.headerBottom,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: postRadius.avatar,
  },
  identity: {
    flex: 1,
    gap: 7,
  },
  lineName: {
    height: 12,
    width: '46%',
  },
  lineMeta: {
    height: 9,
    width: '26%',
  },
  body: {
    paddingHorizontal: postSpacing.gutter,
    paddingBottom: postSpacing.blockBottom,
    gap: 8,
  },
  lineFull: {
    height: 11,
    width: '100%',
  },
  lineShort: {
    height: 11,
    width: '58%',
  },
  media: {
    width: '100%',
    height: 220,
    borderRadius: 0,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: postSpacing.gutter,
    paddingTop: 16,
  },
  chip: {
    flex: 1,
    height: 26,
    borderRadius: postRadius.pill,
  },
})
