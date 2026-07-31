/* src/features/news/components/post/PostCard.tsx

   Carte 100 % présentationnelle. Zéro Firestore, zéro Alert, zéro Modal.
   Toute intention remonte au parent via callbacks stables ; l'écran possède
   une seule galerie, une seule feuille de réactions, un seul menu d'options.

   Le comparateur mémo est explicite : `post` est un nouvel objet à chaque
   `updatePost` du store, donc memo() sans comparateur ne servait à rien. */

import { memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { PostHeader } from './PostHeader'
import { PostBody } from './PostBody'
import { PostMedia } from './PostMedia'
import { PostActions, PostStats } from './PostActionBar'
import PollView from '../PollView'
import { postColors, postSpacing } from '../../theme/postTokens'
import type { NewsPost, PostReactionType } from '../../types'

/** État du post vu par l'utilisateur courant, calculé par l'écran. */
export interface PostViewerState {
  reaction: PostReactionType | null
  saved: boolean
  reposted: boolean
  repostCount: number
  reactionTotal: number
  repostPending: boolean
}

export interface PostCardHandlers {
  onOpenPost: (post: NewsPost) => void
  onOpenAuthor: (userId: string) => void
  onOpenOptions: (post: NewsPost) => void
  onOpenMedia: (post: NewsPost, index: number) => void
  onOpenComments: (post: NewsPost) => void
  onOpenReactionList: (post: NewsPost) => void
  onOpenReactionPicker: (post: NewsPost) => void
  onToggleReaction: (post: NewsPost) => void
  onToggleSave: (post: NewsPost) => void
  onToggleRepost: (post: NewsPost) => void
  onShare: (post: NewsPost) => void
}

interface PostCardProps extends PostCardHandlers {
  post: NewsPost
  currentUserId: string
  viewer: PostViewerState
}

function PostCardComponent({
  post,
  currentUserId,
  viewer,
  onOpenPost,
  onOpenAuthor,
  onOpenOptions,
  onOpenMedia,
  onOpenComments,
  onOpenReactionList,
  onOpenReactionPicker,
  onToggleReaction,
  onToggleSave,
  onToggleRepost,
  onShare,
}: PostCardProps) {
  return (
    <View style={styles.card}>
      <PostHeader
        post={post}
        isOwner={post.userId === currentUserId}
        onOpenAuthor={onOpenAuthor}
        onOpenOptions={onOpenOptions}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ouvrir la publication"
        onPress={() => onOpenPost(post)}
      >
        <PostBody post={post} />
      </Pressable>

      <PostMedia
        media={post.media}
        onOpenImage={(index) => onOpenMedia(post, index)}
        onOpenVideo={() => onOpenPost(post)}
      />

      {post.poll ? (
        <View style={styles.poll}>
          <PollView poll={post.poll} postId={post.id} currentUserId={currentUserId} />
        </View>
      ) : null}

      <PostStats
        post={post}
        reactionTotal={viewer.reactionTotal}
        repostCount={viewer.repostCount}
        saved={viewer.saved}
        onOpenReactionList={onOpenReactionList}
        onOpenComments={onOpenComments}
        onToggleSave={onToggleSave}
      />

      <PostActions
        post={post}
        reaction={viewer.reaction}
        reposted={viewer.reposted}
        repostPending={viewer.repostPending}
        onToggleReaction={onToggleReaction}
        onOpenReactionPicker={onOpenReactionPicker}
        onComment={onOpenComments}
        onRepost={onToggleRepost}
        onShare={onShare}
      />
    </View>
  )
}

/* Comparaison champ par champ : on ignore volontairement likedBy / savedBy /
   repostedBy (tableaux réécrits en permanence) puisque l'écran en dérive déjà
   `viewer`, composé uniquement de primitives. */
function areEqual(previous: PostCardProps, next: PostCardProps): boolean {
  const a = previous.post
  const b = next.post

  return (
    a.id === b.id &&
    a.text === b.text &&
    a.media === b.media &&
    a.poll === b.poll &&
    a.background === b.background &&
    a.visibility === b.visibility &&
    a.commentsEnabled === b.commentsEnabled &&
    a.comments === b.comments &&
    a.shares === b.shares &&
    a.userName === b.userName &&
    a.userPhotoURL === b.userPhotoURL &&
    a.updatedAt?.getTime() === b.updatedAt?.getTime() &&
    previous.currentUserId === next.currentUserId &&
    previous.viewer.reaction === next.viewer.reaction &&
    previous.viewer.saved === next.viewer.saved &&
    previous.viewer.reposted === next.viewer.reposted &&
    previous.viewer.repostCount === next.viewer.repostCount &&
    previous.viewer.reactionTotal === next.viewer.reactionTotal &&
    previous.viewer.repostPending === next.viewer.repostPending
  )
}

export const PostCard = memo(PostCardComponent, areEqual)

const styles = StyleSheet.create({
  card: {
    backgroundColor: postColors.surface,
    borderBottomWidth: postSpacing.cardGap,
    borderBottomColor: postColors.canvas,
  },
  poll: {
    paddingHorizontal: postSpacing.gutter,
    paddingBottom: postSpacing.blockBottom,
  },
})
