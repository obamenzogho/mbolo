/* src/features/news/components/post/PostHeader.tsx
   Auteur, humeur, ancienneté, visibilité, accès aux options.
   Purement présentationnel : aucune écriture Firestore, aucun Alert. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { getAvatarImageUrl } from '@/lib/cloudinary'
import {
  HIT_SLOP,
  postColors,
  postMotion,
  postRadius,
  postSpacing,
  postType,
} from '../../theme/postTokens'
import { absoluteDate, timeAgo } from '../../utils/format'
import type { NewsPost, NewsPostVisibility } from '../../types'

type IoniconName = keyof typeof Ionicons.glyphMap

const VISIBILITY_ICON: Record<NewsPostVisibility, IoniconName> = {
  public: 'earth',
  followers: 'people',
  private: 'lock-closed',
}

const VISIBILITY_LABEL: Record<NewsPostVisibility, string> = {
  public: 'Visible par tout le monde',
  followers: 'Visible par les abonnés',
  private: 'Visible par moi uniquement',
}

interface PostHeaderProps {
  post: NewsPost
  isOwner: boolean
  onOpenAuthor: (userId: string) => void
  onOpenOptions: (post: NewsPost) => void
}

function PostHeaderComponent({
  post,
  isOwner,
  onOpenAuthor,
  onOpenOptions,
}: PostHeaderProps) {
  const avatarUri = post.userPhotoURL
    ? getAvatarImageUrl(post.userPhotoURL, 120)
    : null

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Profil de ${post.userName}`}
        onPress={() => onOpenAuthor(post.userId)}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {avatarUri ? (
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
        )}
      </Pressable>

      <View style={styles.identity}>
        <Text style={styles.author} numberOfLines={1}>
          <Text
            onPress={() => onOpenAuthor(post.userId)}
            suppressHighlighting
          >
            {post.userName}
          </Text>
          {post.mood ? (
            <Text style={styles.authorSuffix}>
              {`  se sent ${post.mood.emoji} ${post.mood.label}`}
            </Text>
          ) : null}
        </Text>

        <View
          style={styles.metaRow}
          accessible
          accessibilityLabel={`Publié le ${absoluteDate(post.createdAt)}. ${
            VISIBILITY_LABEL[post.visibility]
          }`}
        >
          <Text style={styles.meta}>{timeAgo(post.createdAt)}</Text>
          {post.updatedAt ? <Text style={styles.meta}>· modifié</Text> : null}
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
            ? 'Options de ma publication'
            : `Options de la publication de ${post.userName}`
        }
        onPress={() => onOpenOptions(post)}
        style={({ pressed }) => [styles.optionsButton, pressed && styles.pressed]}
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
    alignItems: 'center',
    gap: postSpacing.rowGap,
    paddingHorizontal: postSpacing.gutter,
    paddingTop: postSpacing.headerTop,
    paddingBottom: postSpacing.headerBottom,
  },
  pressed: {
    opacity: postMotion.pressedOpacity,
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
  author: {
    ...postType.author,
    color: postColors.textPrimary,
  },
  authorSuffix: {
    ...postType.authorSuffix,
    color: postColors.textSecondary,
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
  optionsButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
