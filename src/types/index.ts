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
  createdAt: Date
  verified?: boolean
  externalLink?: string
  externalLinks?: { platform: string; url: string }[]
  totalViews?: number
  accountType?: 'personal' | 'creator' | 'business'
  category?: string
  privateAccount?: boolean
  notifications?: boolean
}

export interface Video {
  id: string
  userId: string
  videoURL: string
  thumbnailURL?: string
  description: string
  hashtags: string[]
  likes: number
  comments: number
  shares: number
  saves: number
  savedBy?: string[]
  soundId?: string
  type?: 'video' | 'reel'
  views?: number
  likedBy?: string[]
  createdAt: Date
}

export interface Comment {
  id: string
  userId: string
  videoId: string
  text: string
  likes: number
  likedBy: string[]
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
  type: 'like' | 'comment' | 'follow' | 'message'
  fromUserId: string
  videoId?: string
  read: boolean
  createdAt: Date
}

export interface Conversation {
  id: string
  participants: string[]
  lastMessage?: string
  lastMessageAt?: Date
  updatedAt: Date
}
