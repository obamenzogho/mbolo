export type ShareType =
  | 'DM_SHARE'
  | 'GROUP_SHARE'
  | 'STORY_SHARE'
  | 'EXTERNAL_SHARE'
  | 'COPY_LINK'
  | 'SYSTEM_SHARE'

export interface Share {
  id: string
  senderId: string
  receiverId?: string
  groupId?: string
  postId: string
  shareType: ShareType
  createdAt: Date
}

export interface ShareGroupShare {
  id: string
  groupId: string
  senderId: string
  postId: string
  createdAt: Date
}

export interface ShareAnalytics {
  id: string
  postId: string
  totalShares: number
  dmShares: number
  groupShares: number
  externalShares: number
  storyShares: number
  copyLinkCount: number
}

export interface ShareSuggestion {
  userId: string
  pseudo: string
  nom?: string
  photoURL?: string
  score: number
  reason?: string
}

export interface ShareSearchResult {
  id: string
  pseudo: string
  nom?: string
  photoURL?: string
  isFriend?: boolean
}
