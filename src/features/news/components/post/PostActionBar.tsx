/* src/features/news/components/post/PostActionBar.tsx
   Deux blocs : le résumé social (PostStats) et les actions (PostActions).
   Modèle aligné sur le feed vidéo : un j'aime simple, un enregistrement,
   un repost et un partage. Plus de réactions multiples ni d'emojis empilés. */

import { memo, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useI18n } from '@/i18n'
import {
  HIT_SLOP,
  postColors,
  postMotion,
  postRadius,
  postSpacing,
  postType,
} from '../../theme/postTokens'
import { countLabel, formatCount, interpolate } from '../../utils/format'
import type { NewsPost } from '../../types'

type IoniconName = keyof typeof Ionicons.glyphMap

/* ── Résumé social ─────────────────────────────────────────── */

interface PostStatsProps {
  post: NewsPost
  saved: boolean
  onOpenReactions: (post: NewsPost) => void
  onOpenComments: (post: NewsPost) => void
  onToggleSave: (post: NewsPost) => void
}

function PostStatsComponent({
  post,
  saved,
  onOpenReactions,
  onOpenComments,
  onToggleSave,
}: PostStatsProps) {
  const { t } = useI18n()
  const hasActivity =
    post.likes > 0 || post.comments > 0 || post.shares > 0 || post.reposts > 0

  if (!hasActivity && !saved) return null

  return (
    <View style={styles.stats}>
      {post.likes > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={interpolate(
            t.news.actions.a11yLikes,
            post.likes,
          )}
          onPress={() => onOpenReactions(post)}
          style={({ pressed }) => [styles.likeSummary, pressed && styles.pressed]}
        >
          <View style={styles.likeBadge}>
            <Ionicons name="thumbs-up" size={11} color="#FFFFFF" />
          </View>
          <Text style={styles.statText}>{formatCount(post.likes)}</Text>
        </Pressable>
      ) : (
        <View />
      )}

      <View style={styles.statsRight}>
        {post.reposts > 0 ? (
          <Text style={styles.statText}>
            {countLabel(
              post.reposts,
              t.news.actions.pluralRepost,
              t.news.actions.pluralReposts,
            )}
          </Text>
        ) : null}

        {post.comments > 0 ? (
          <Text
            accessibilityRole="button"
            onPress={() => onOpenComments(post)}
            style={styles.statText}
          >
            {countLabel(
              post.comments,
              t.news.actions.pluralComment,
              t.news.actions.pluralComments,
            )}
          </Text>
        ) : null}

        {post.shares > 0 ? (
          <Text style={styles.statText}>
            {countLabel(
              post.shares,
              t.news.actions.pluralShare,
              t.news.actions.pluralShares,
            )}
          </Text>
        ) : null}

        <Pressable
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={
            saved ? t.news.actions.a11yRemoveSave : t.news.actions.a11ySave
          }
          onPress={() => onToggleSave(post)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={15}
            color={saved ? postColors.accent : postColors.textSecondary}
          />
        </Pressable>
      </View>
    </View>
  )
}

export const PostStats = memo(PostStatsComponent)

/* ── Actions ───────────────────────────────────────────────── */

function ActionButton({
  icon,
  label,
  active,
  disabled,
  accessibilityLabel,
  onPress,
}: {
  icon: IoniconName
  label: string
  active?: boolean
  disabled?: boolean
  accessibilityLabel: string
  onPress: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current

  const bounce = () => {
    scale.setValue(0.86)
    Animated.spring(scale, { toValue: 1, ...postMotion.spring }).start()
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => {
        bounce()
        void Haptics.selectionAsync()
        onPress()
      }}
      style={({ pressed }) => [
        styles.action,
        active && styles.actionActive,
        pressed && styles.pressed,
        disabled && styles.actionDisabled,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={icon}
          size={20}
          color={active ? postColors.accent : postColors.textSecondary}
        />
      </Animated.View>

      <Text
        style={[styles.actionText, active && styles.actionTextActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}

interface PostActionsProps {
  post: NewsPost
  liked: boolean
  reposted: boolean
  repostPending: boolean
  onToggleLike: (post: NewsPost) => void
  onComment: (post: NewsPost) => void
  onRepost: (post: NewsPost) => void
  onShare: (post: NewsPost) => void
}

function PostActionsComponent({
  post,
  liked,
  reposted,
  repostPending,
  onToggleLike,
  onComment,
  onRepost,
  onShare,
}: PostActionsProps) {
  const { t } = useI18n()

  return (
    <>
      <View style={styles.divider} />

      <View style={styles.actions}>
        <ActionButton
          icon={liked ? 'thumbs-up' : 'thumbs-up-outline'}
          label={t.news.actions.like}
          active={liked}
          accessibilityLabel={
            liked ? t.news.actions.a11yUnlike : t.news.actions.a11yLike
          }
          onPress={() => onToggleLike(post)}
        />

        {post.commentsEnabled ? (
          <ActionButton
            icon="chatbubble-outline"
            label={t.news.actions.comment}
            accessibilityLabel={t.news.actions.a11yComment}
            onPress={() => onComment(post)}
          />
        ) : null}

        <ActionButton
          icon="repeat-outline"
          label={t.news.actions.repost}
          active={reposted}
          disabled={repostPending}
          accessibilityLabel={
            reposted ? t.news.actions.a11yReposted : t.news.actions.a11yRepost
          }
          onPress={() => onRepost(post)}
        />

        <ActionButton
          icon="arrow-redo-outline"
          label={t.news.actions.share}
          accessibilityLabel={t.news.actions.a11yShare}
          onPress={() => onShare(post)}
        />
      </View>
    </>
  )
}

export const PostActions = memo(PostActionsComponent)

const styles = StyleSheet.create({
  stats: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: postSpacing.gutter,
  },
  likeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.inlineGap,
    paddingVertical: 4,
  },
  likeBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.accent,
  },
  statText: {
    ...postType.stat,
    color: postColors.textSecondary,
  },
  statsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: postSpacing.gutter,
    marginTop: 2,
    backgroundColor: postColors.hairline,
  },
  actions: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  action: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: postRadius.pill,
  },
  actionActive: {
    backgroundColor: postColors.accentSoft,
  },
  actionDisabled: {
    opacity: 0.45,
  },
  actionText: {
    ...postType.action,
    color: postColors.textSecondary,
  },
  actionTextActive: {
    color: postColors.accent,
  },
  pressed: {
    opacity: postMotion.pressedOpacity,
  },
})
