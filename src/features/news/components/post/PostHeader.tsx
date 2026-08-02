/* src/features/news/components/post/PostHeader.tsx
   En-tête style Facebook : avatar (anneau de story), nom + badge vérifié,
   ligne d'activité (humeur · lieu), horodatage relatif, visibilité,
   bouton Suivre et accès aux options.
   Aucune écriture Firestore ici : seul le Suivre lit l'état d'abonnement
   (même pattern que AuthorInfo du feed) et délègue à useFollowAction. */

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { getAvatarImageUrl } from '@/lib/cloudinary'
import { useI18n } from '@/i18n'
import { useFollowFast } from '@/hooks/useFollowFast'
import { useFollowAction } from '@/hooks/useFollowAction'
import {
  HIT_SLOP,
  postColors,
  postMotion,
  postRadius,
  postSpacing,
  postType,
} from '../../theme/postTokens'
import { absoluteDate, timeAgo } from '../../utils/format'
import type { TimeLabels } from '../../utils/format'
import type { NewsPost, NewsPostVisibility } from '../../types'

type IoniconName = keyof typeof Ionicons.glyphMap

/** Écart minimal entre createdAt et updatedAt pour parler de « modifié »
 *  (anciens posts créés avec updatedAt == createdAt). */
const POST_EDIT_THRESHOLD_MS = 60_000

const VISIBILITY_ICON: Record<NewsPostVisibility, IoniconName> = {
  public: 'earth',
  followers: 'people',
  private: 'lock-closed',
}

interface PostHeaderProps {
  post: NewsPost
  isOwner: boolean
  /** Un anneau signalise que l'auteur a une story non lue (calculé par l'écran). */
  hasStory?: boolean
  onOpenAuthor: (userId: string) => void
  onOpenOptions: (post: NewsPost) => void
}

function PostHeaderComponent({
  post,
  isOwner,
  hasStory = false,
  onOpenAuthor,
  onOpenOptions,
}: PostHeaderProps) {
  const { t } = useI18n()
  const avatarUri = post.userPhotoURL
    ? getAvatarImageUrl(post.userPhotoURL, 120)
    : null

  // Pas de lecture pour ses propres posts : la pastille Suivre n'existe pas.
  const { isFollowing, resolved: followResolved } = useFollowFast(
    isOwner ? '' : post.userId,
  )
  const { toggleFollow } = useFollowAction()
  const [followState, setFollowState] = useState<'idle' | 'done' | 'hidden'>('idle')
  const followTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(followTimer.current), [])

  const showFollow =
    !isOwner && followResolved && !isFollowing && followState !== 'hidden'

  const handleFollow = () => {
    if (followState !== 'idle') return
    void toggleFollow(post.userId)
    setFollowState('done')
    clearTimeout(followTimer.current)
    followTimer.current = setTimeout(() => setFollowState('hidden'), 2000)
  }

  const timeLabels = useMemo<TimeLabels>(
    () => ({
      justNow: t.news.time.justNow,
      minutes: t.news.time.minutes,
      hours: t.news.time.hours,
      yesterday: t.news.time.yesterday,
      days: t.news.time.days,
    }),
    [t],
  )

  const visibilityLabel = t.news[
    post.visibility === 'public'
      ? 'visibilityPublic'
      : post.visibility === 'followers'
        ? 'visibilityFollowers'
        : 'visibilityPrivate'
  ]

  const moodLabel = post.mood
    ? (t.news.moods as Record<string, string | undefined>)[post.mood.emoji] ??
      post.mood.label
    : null

  const activity = [
    post.mood ? `${t.news.activityFeeling} ${post.mood.emoji} ${moodLabel}` : null,
    post.location ? `${t.news.activityAt} ${post.location.name}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const avatarInner = avatarUri ? (
    <Image
      source={{ uri: avatarUri }}
      style={styles.avatar}
      contentFit="cover"
      transition={postMotion.imageTransition}
      recyclingKey={post.userId}
    />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Ionicons name="person" size={22} color={postColors.textTertiary} />
    </View>
  )

  const avatar = hasStory ? (
    <View style={styles.storyRing}>{avatarInner}</View>
  ) : (
    avatarInner
  )

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.news.a11yProfileOf} ${post.userName}`}
        onPress={() => onOpenAuthor(post.userId)}
        style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
      >
        {avatar}
      </Pressable>

      <View style={styles.identity}>
        <View style={styles.authorRow}>
          <Text style={styles.author} numberOfLines={1}>
            <Text
              onPress={() => onOpenAuthor(post.userId)}
              suppressHighlighting
            >
              {post.userName}
            </Text>
            {post.verified ? (
              <Text accessible accessibilityLabel={t.news.a11yVerified}>
                {'  '}
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={postColors.verified}
                />
              </Text>
            ) : null}
          </Text>

          {showFollow ? (
            <TouchableOpacity
              hitSlop={HIT_SLOP}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                followState === 'done' ? t.news.followDone : t.follow.follow
              }
              onPress={handleFollow}
              style={styles.followPill}
            >
              <Ionicons
                name={followState === 'done' ? 'checkmark' : 'add'}
                size={13}
                color={'#000000'}
              />
              <Text style={styles.followPillText}>
                {followState === 'done' ? t.news.followDone : t.follow.follow}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {activity ? (
          <Text style={styles.activity} numberOfLines={1}>
            {activity}
          </Text>
        ) : null}

        <View
          style={styles.metaRow}
          accessible
          accessibilityLabel={`${t.news.a11yPublishedOn} ${absoluteDate(post.createdAt)}. ${visibilityLabel}`}
        >
          <Text style={styles.meta}>{timeAgo(post.createdAt, undefined, timeLabels)}</Text>
          {post.updatedAt &&
          post.updatedAt.getTime() - post.createdAt.getTime() >
            POST_EDIT_THRESHOLD_MS ? (
            <Text style={styles.meta}>· {t.news.edited}</Text>
          ) : null}
          <Text style={styles.meta} accessibilityElementsHidden>
            ·
          </Text>
          <Ionicons
            name={VISIBILITY_ICON[post.visibility]}
            size={12}
            color={postColors.textSecondary}
          />
        </View>
      </View>

      <Pressable
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={
          isOwner
            ? t.news.a11yMyOptions
            : `${t.news.a11yOptionsOf} ${post.userName}`
        }
        onPress={() => onOpenOptions(post)}
        style={({ pressed }) => [
          styles.optionsButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={20}
          color={postColors.textSecondary}
        />
      </Pressable>
    </View>
  )
}

export const PostHeader = memo(PostHeaderComponent)

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: postSpacing.rowGap,
    paddingHorizontal: postSpacing.gutter,
    paddingTop: postSpacing.headerTop,
    paddingBottom: postSpacing.headerBottom,
  },
  pressed: {
    opacity: postMotion.pressedOpacity,
  },
  avatarWrap: {
    alignSelf: 'center',
  },
  storyRing: {
    padding: 2,
    borderRadius: postRadius.avatar + 2,
    borderWidth: 2,
    borderColor: postColors.accent,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: postRadius.avatar,
    backgroundColor: postColors.surfaceRaised,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  author: {
    ...postType.author,
    flexShrink: 1,
    color: postColors.textPrimary,
  },
  activity: {
    ...postType.authorSuffix,
    fontSize: 13,
    color: postColors.textSecondary,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  meta: {
    ...postType.meta,
    color: postColors.textSecondary,
  },
  followPill: {
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 13,
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
  },
  followPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  optionsButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.buttonDark,
    borderWidth: 1,
    borderColor: postColors.hairline,
    borderRadius: 16,
  },
})
