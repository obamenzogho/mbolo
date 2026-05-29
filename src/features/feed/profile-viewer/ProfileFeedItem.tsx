/* ProfileFeedItem — item vidéo pour ProfileVideoViewer.
   Rôle : wrapper de FeedItem, ajoute les callbacks comment/share
   et l'overlay de navigation. */

import { memo } from 'react'
import { FeedItem } from '../components/FeedItem'
import type { Video } from '../../../types'
import type { ShareVideoData } from '../../../components/ShareModal'

interface ProfileFeedItemProps {
  item: Video
  index: number
  isActive: boolean
  onPressComments: (videoId: string) => void
  onOpenShare: (data: ShareVideoData) => void
  username: string
  instanceId: string
}

function ProfileFeedItemComponent({
  item, index, isActive, onPressComments, onOpenShare, username, instanceId,
}: ProfileFeedItemProps) {
  return (
    <FeedItem
      item={item}
      index={index}
      instanceId={instanceId}
      isActive={isActive}
      username={username}
      onPressComment={onPressComments}
      onPressShare={onOpenShare}
    />
  )
}

export const ProfileFeedItem = memo(ProfileFeedItemComponent)
