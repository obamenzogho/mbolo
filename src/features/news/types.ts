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
  createdAt: Date
  updatedAt?: Date
}
