/* ProfileFeedItem — item vidéo pour ProfileVideoViewer.
   Rôle : wrapper de FeedItem, ajoute les callbacks comment/share
   et l'overlay de navigation. */

import { memo } from 'react'
import { FeedItem } from '../components/FeedItem'
import type { Video } from '../../../types'

interface ProfileFeedItemProps {
  item: Video
  index: number
  isActive: boolean
  onPressComments: (videoId: string) => void
  onPressShare: (videoId: string) => void
  username: string
  instanceId: string
  itemHeight?: number
}

function ProfileFeedItemComponent({
  item, index, isActive, onPressComments, onPressShare, username, instanceId, itemHeight,
}: ProfileFeedItemProps) {
  return (
    <FeedItem
      item={item}
      index={index}
      instanceId={instanceId}
      isActive={isActive}
      username={username}
      itemHeight={itemHeight}
      immersive={false}
      onPressComment={onPressComments}
      onPressShare={onPressShare}
    />
  )
}

export const ProfileFeedItem = memo(ProfileFeedItemComponent)
