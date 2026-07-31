/* src/features/news/components/post/PostActionBar.tsx
   Deux blocs : le résumé social (PostStats) et les actions (PostActions).
   « Enregistrer » migre dans le résumé en icône seule : cinq actions à plat
   écrasaient les libellés sur petit écran. */

import { memo, useMemo, useRef } from 'react'
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
import { countLabel, formatCount } from '../../utils/format'
import { REACTION_EMOJI, REACTION_LABELS } from '../../types'
import type { NewsPost, PostReactionType, ReactionCounts } from '../../types'

type IoniconName = keyof typeof Ionicons.glyphMap

/* ── Résumé social ─────────────────────────────────────────── */

interface PostStatsProps {
  post: NewsPost
  reactionTotal: number
  repostCount: number
  saved: boolean
  onOpenReactionList: (post: NewsPost) => void
  onOpenComments: (post: NewsPost) => void
  onToggleSave: (post: NewsPost) => void
}

function topReactions(counts: ReactionCounts | undefined): PostReactionType[] {
  if (!counts) return []

  return (Object.entries(counts) as [string, number][])
    .filter(([key, value]) => key !== 'total' && value > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => key as PostReactionType)
}

function PostStatsComponent({
  post,
  reactionTotal,
  repostCount,
  saved,
  onOpenReactionList,
  onOpenComments,
  onToggleSave,
}: PostStatsProps) {
  const { t } = useI18n()
  const emojis = useMemo(() => topReactions(post.reactionCounts), [post.reactionCounts])
  const hasActivity =
    reactionTotal > 0 || post.comments > 0 || post.shares > 0 || repostCount > 0

  if (!hasActivity && !saved) return null

  return (
    <View style={styles.stats}>
      {reactionTotal > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.news.actions.a11yReactionsDetail.replace(
            '{n}',
            formatCount(reactionTotal),
          )}
          onPress={() => onOpenReactionList(post)}
          style={({ pressed }) => [styles.reactionSummary, pressed && styles.pressed]}
        >
          {emojis.length > 0 ? (
            <View style={styles.emojiStack}>
              {emojis.map((type, index) => (
                <Text
                  key={type}
                  style={[styles.emoji, index > 0 && styles.emojiOverlap]}
                >
                  {REACTION_EMOJI[type]}
                </Text>
              ))}
            </View>
          ) : (
            <View style={styles.likeBadge}>
              <Ionicons name="thumbs-up" size={11} color="#FFFFFF" />
            </View>
          )}
          <Text style={styles.statText}>{formatCount(reactionTotal)}</Text>
        </Pressable>
      ) : (
        <View />
      )}

      <View style={styles.statsRight}>
        {repostCount > 0 ? (
          <Text style={styles.statText}>
            {countLabel(
              repostCount,
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
  emoji,
  disabled,
  accessibilityLabel,
  onPress,
  onLongPress,
}: {
  icon: IoniconName
  label: string
  active?: boolean
  emoji?: string
  disabled?: boolean
  accessibilityLabel: string
  onPress: () => void
  onLongPress?: () => void
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
      onLongPress={
        onLongPress
          ? () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onLongPress()
            }
          : undefined
      }
      style={({ pressed }) => [
        styles.action,
        active && styles.actionActive,
        pressed && styles.pressed,
        disabled && styles.actionDisabled,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {emoji ? (
          <Text style={styles.actionEmoji}>{emoji}</Text>
        ) : (
          <Ionicons
            name={icon}
            size={20}
            color={active ? postColors.accent : postColors.textSecondary}
          />
        )}
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
  reaction: PostReactionType | null
  reposted: boolean
  repostPending: boolean
  onToggleReaction: (post: NewsPost) => void
  onOpenReactionPicker: (post: NewsPost) => void
  onComment: (post: NewsPost) => void
  onRepost: (post: NewsPost) => void
  onShare: (post: NewsPost) => void
}

function PostActionsComponent({
  post,
  reaction,
  reposted,
  repostPending,
  onToggleReaction,
  onOpenReactionPicker,
  onComment,
  onRepost,
  onShare,
}: PostActionsProps) {
  const { t } = useI18n()
  const reactionLabel = reaction ? REACTION_LABELS[reaction] : t.news.actions.like

  return (
    <>
      <View style={styles.divider} />

      <View style={styles.actions}>
        <ActionButton
          icon={reaction ? 'thumbs-up' : 'thumbs-up-outline'}
          emoji={reaction ? REACTION_EMOJI[reaction] : undefined}
          label={reactionLabel}
          active={!!reaction}
          accessibilityLabel={
            reaction
              ? t.news.actions.a11yReaction.replace('{label}', REACTION_LABELS[reaction])
              : t.news.actions.a11yLike
          }
          onPress={() => onToggleReaction(post)}
          onLongPress={() => onOpenReactionPicker(post)}
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
  reactionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.inlineGap,
    paddingVertical: 4,
  },
  emojiStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 14,
  },
  emojiOverlap: {
    marginLeft: -4,
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
  actionEmoji: {
    fontSize: 19,
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
