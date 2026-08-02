/* src/features/news/components/post/PostCard.tsx

   Carte 100 % présentationnelle. Zéro Firestore, zéro Alert, zéro Modal.
   Toute intention remonte au parent via callbacks stables ; l'écran possède
   une seule galerie, un seul menu d'options, une seule modale de commentaires.

   Le comparateur mémo est explicite : `post` est un nouvel objet à chaque
   `updatePost` du store, donc memo() sans comparateur ne servait à rien. */

import { memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useI18n } from '@/i18n'
import { PostHeader } from './PostHeader'
import { PostBody } from './PostBody'
import { PostMedia } from './PostMedia'
import { PostVideoShare } from './PostVideoShare'
import { PostActions, PostStats } from './PostActionBar'
import PollView from '../PollView'
import { postColors, postSpacing } from '../../theme/postTokens'
import type { NewsPost } from '../../types'

/** État du post vu par l'utilisateur courant, calculé par l'écran. */
export interface PostViewerState {
  liked: boolean
  saved: boolean
  reposted: boolean
  repostCount: number
  repostPending: boolean
}

export interface PostCardHandlers {
  onOpenPost: (post: NewsPost) => void
  onOpenAuthor: (userId: string) => void
  onOpenOptions: (post: NewsPost) => void
  onOpenMedia: (post: NewsPost, index: number) => void
  onOpenComments: (post: NewsPost) => void
  onOpenSharedVideo: (videoId: string) => void
  onToggleLike: (post: NewsPost) => void
  onToggleSave: (post: NewsPost) => void
  onToggleRepost: (post: NewsPost) => void
  onShare: (post: NewsPost) => void
  onToggleExpanded: (postId: string) => void
}

interface PostCardProps extends PostCardHandlers {
  post: NewsPost
  currentUserId: string
  viewer: PostViewerState
  /** L'auteur a une story non lue (anneau autour de l'avatar). */
  hasStory?: boolean
  /** Légende dépliée (état possédé par l'écran). */
  expanded?: boolean
}

function PostCardComponent({
  post,
  currentUserId,
  viewer,
  hasStory = false,
  expanded = false,
  onOpenPost,
  onOpenAuthor,
  onOpenOptions,
  onOpenMedia,
  onOpenComments,
  onOpenSharedVideo,
  onToggleLike,
  onToggleSave,
  onToggleRepost,
  onShare,
  onToggleExpanded,
}: PostCardProps) {
  const { t } = useI18n()

  return (
    <View style={styles.card}>
      <PostHeader
        post={post}
        isOwner={post.userId === currentUserId}
        hasStory={hasStory}
        onOpenAuthor={onOpenAuthor}
        onOpenOptions={onOpenOptions}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.news.a11yOpenPost}
        onPress={() => onOpenPost(post)}
      >
        <PostBody
          post={post}
          expanded={expanded}
          onToggleExpanded={() => onToggleExpanded(post.id)}
        />
      </Pressable>

      <PostMedia
        media={post.media}
        onOpenImage={(index) => onOpenMedia(post, index)}
        onOpenVideo={() => onOpenPost(post)}
      />

      {post.videoShare ? (
        <View style={styles.videoShare}>
          <PostVideoShare
            share={post.videoShare}
            onPress={() => onOpenSharedVideo(post.videoShare!.sharedVideoId)}
          />
        </View>
      ) : null}


      {post.poll ? (
        <View style={styles.poll}>
          <PollView poll={post.poll} postId={post.id} currentUserId={currentUserId} />
        </View>
      ) : null}

      <PostStats
        post={post}
        saved={viewer.saved}
        onOpenReactions={onOpenPost}
        onOpenComments={onOpenComments}
        onToggleSave={onToggleSave}
      />

      <PostActions
        post={post}
        liked={viewer.liked}
        reposted={viewer.reposted}
        repostPending={viewer.repostPending}
        onToggleLike={onToggleLike}
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
    a.videoShare === b.videoShare &&
    a.background === b.background &&
    a.visibility === b.visibility &&
    a.commentsEnabled === b.commentsEnabled &&
    a.likes === b.likes &&
    a.comments === b.comments &&
    a.shares === b.shares &&
    a.saves === b.saves &&
    a.reposts === b.reposts &&
    a.userName === b.userName &&
    a.userPhotoURL === b.userPhotoURL &&
    a.updatedAt?.getTime() === b.updatedAt?.getTime() &&
    previous.currentUserId === next.currentUserId &&
    previous.hasStory === next.hasStory &&
    previous.expanded === next.expanded &&
    previous.viewer.liked === next.viewer.liked &&
    previous.viewer.saved === next.viewer.saved &&
    previous.viewer.reposted === next.viewer.reposted &&
    previous.viewer.repostCount === next.viewer.repostCount &&
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
  videoShare: {
    paddingBottom: postSpacing.blockBottom,
  },
})
