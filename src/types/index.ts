export interface User {
  id: string
  email: string
  nom: string
  pseudo: string
  dateOfBirth?: string
  photoURL?: string
  bio?: string
  city?: string
  showAge?: boolean
  followers: string[]
  following: string[]
  followerCount?: number
  followingCount?: number
  postsCount?: number
  createdAt: Date
  verified?: boolean
  externalLink?: string
  externalLinks?: { platform: string; url: string }[]
  totalViews?: number
  accountType?: 'personal' | 'creator' | 'business'
  category?: string
  privateAccount?: boolean
  pendingFollowers?: string[]
  pendingFollowings?: string[]
  notifications?: boolean
  seenVideos?: string[]
  genre?: 'homme' | 'femme' | 'non-binaire' | 'prefere-ne-pas-dire'
}

export type ProfileTab = 'grid' | 'saved' | 'liked' | 'reposted' | 'tagged'

export interface Repost {
  id: string
  userId: string
  postId: string
  createdAt: Date
}

export interface PreviewComment {
  id: string
  text: string
  authorName: string
  authorPhoto?: string
  likes: number
}

export interface Video {
  id: string
  userId: string
  userName?: string
  userPhotoURL?: string
  videoURL: string
  videoURL_720p?: string
  videoURL_480p?: string
  videoURL_360p?: string
  thumbnailURL?: string
  description: string
  hashtags: string[]
  likes: number
  comments: number
  shares: number
  reposts: number
  repostedBy?: string[]
  latestRepostedBy?: { userId: string; userName: string }
  saves: number
  savedBy?: string[]
  soundId?: string
  type?: 'video' | 'reel'
  views?: number
  likedBy?: string[]
  corrupted?: boolean
  place?: string
  lat?: number
  lng?: number
  geohash?: string
  createdAt: Date
  previewComments?: PreviewComment[]
}

export interface Comment {
  id: string
  userId: string
  videoId: string
  text: string
  likes: number
  likedBy: string[]
  dislikes: number
  dislikedBy: string[]
  replyCount: number
  authorName?: string
  authorPhoto?: string
  createdAt: Date
}

export interface Reply {
  id: string
  userId: string
  videoId: string
  commentId?: string
  text: string
  likes: number
  likedBy: string[]
  dislikes: number
  dislikedBy: string[]
  replyToUsername?: string
  username?: string
  authorName?: string
  authorPhoto?: string
  createdAt: Date
}

export interface StoryRef {
  storyId: string
  mediaUrl: string
  mediaType: string
  ownerId: string
}

export interface Message {
  id: string
  senderId: string
  text: string
  type: 'text' | 'image' | 'story_reply'
  mediaUrl?: string
  storyRef?: StoryRef
  createdAt: Date
}

export interface Story {
  id: string
  userId: string
  mediaURL: string
  type: 'image' | 'video'
  expiresAt: Date
  viewers: string[]
  createdAt: Date
}

export interface Notification {
  id: string
  userId: string
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accept' | 'message' | 'reply' | 'repost' | 'share' | 'tag' | 'mention'
  fromUserId: string
  videoId?: string
  read: boolean
  createdAt: Date
}

export interface Conversation {
  id: string
  participants: string[]
  spamFor?: string[]
  blockedBy?: string[]
  pinnedBy?: string[]
  mutedBy?: string[]
  deletedBy?: string[]
  lastMessage?: {
    text: string
    senderId: string
    createdAt: Date
  }
  updatedAt: Date
  lastReadAt?: Record<string, Date>
  lastDeliveredAt?: Record<string, Date>
  typingBy?: Record<string, Date>
}
