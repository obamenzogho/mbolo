/* src/features/news/components/post/PostCardSkeleton.tsx
   Remplace le loader plein écran au premier chargement : la structure du fil
   apparaît immédiatement, la perception de latence chute.
   Pulsation d'opacité uniquement via ShimmerBlock (propriété non-layout,
   driver natif). */

import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { ShimmerBlock } from '../Skeletons'
import { postColors, postRadius, postSpacing } from '../../theme/postTokens'

function PostCardSkeletonComponent({ withMedia = true }: { withMedia?: boolean }) {
  return (
    <View style={styles.card} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.header}>
        <ShimmerBlock style={styles.avatar} color={postColors.surfaceRaised} />
        <View style={styles.identity}>
          <ShimmerBlock style={styles.lineName} color={postColors.surfaceRaised} />
          <ShimmerBlock style={styles.lineMeta} color={postColors.surfaceRaised} />
        </View>
      </View>

      <View style={styles.body}>
        <ShimmerBlock style={styles.lineFull} color={postColors.surfaceRaised} />
        <ShimmerBlock style={styles.lineFull} color={postColors.surfaceRaised} />
        <ShimmerBlock style={styles.lineShort} color={postColors.surfaceRaised} />
      </View>

      {withMedia ? <ShimmerBlock style={styles.media} color={postColors.surfaceRaised} /> : null}

      <View style={styles.footer}>
        <ShimmerBlock style={styles.chip} color={postColors.surfaceRaised} />
        <ShimmerBlock style={styles.chip} color={postColors.surfaceRaised} />
        <ShimmerBlock style={styles.chip} color={postColors.surfaceRaised} />
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
