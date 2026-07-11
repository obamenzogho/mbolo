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

export interface NewsPoll {
  question: string
  options: { id: string; text: string; votes: number; votedBy: string[] }[]
}

export interface NewsLocation {
  name: string
  lat?: number
  lng?: number
}

export interface NewsMood {
  emoji: string
  label: string
}

export const POST_BACKGROUNDS: { id: string; colors: [string, string] }[] = [
  { id: 'none', colors: ['#111214', '#111214'] },
  { id: 'sunset', colors: ['#F58529', '#DD2A7B'] },
  { id: 'ocean', colors: ['#2193B0', '#6DD5ED'] },
  { id: 'forest', colors: ['#11998E', '#38EF7D'] },
  { id: 'purple', colors: ['#8134AF', '#515BD4'] },
  { id: 'night', colors: ['#232526', '#414345'] },
  { id: 'gabon', colors: ['#009E60', '#FCD116'] },
]

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
  background?: string
  location?: NewsLocation
  mood?: NewsMood
  poll?: NewsPoll
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
