export type NewsPostFormat =
  | 'text'
  | 'image'
  | 'carousel'
  | 'video'

export type NewsPostVisibility = 'public' | 'followers' | 'private'

export interface NewsPostMedia {
  url: string
  type: 'image' | 'video'
  width?: number
  height?: number
  duration?: number
  thumbnailUrl?: string
}

export interface NewsPost {
  id: string
  userId: string
  userName: string
  userPhotoURL?: string
  text: string
  format: NewsPostFormat
  media: NewsPostMedia[]
  visibility: NewsPostVisibility
  commentsEnabled: boolean
  likes: number
  likedBy: string[]
  comments: number
  shares: number
  saves: number
  savedBy: string[]
  createdAt: Date
  updatedAt?: Date
}

export interface NewsComment {
  id: string
  postId: string
  userId: string
  userName: string
  userPhotoURL?: string
  text: string
  likes: number
  likedBy: string[]
  createdAt: Date
}
