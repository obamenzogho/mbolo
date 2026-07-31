import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { blockUser } from '../services/moderationService'
import { ReportModal } from './ReportModal'
import type { ReportTarget } from '../services/moderationService'
import { colors } from '../lib/theme'
import { useI18n } from '../i18n'

interface Props {
  visible: boolean
  targetType: ReportTarget
  targetId: string
  contentOwnerId?: string
  contentOwnerName?: string
  commentPath?: string
  /** Menu enrichi (posts) : état et actions optionnels, fournis par l'écran. */
  isFollowing?: boolean
  onToggleFollow?: () => void
  isSaved?: boolean
  onToggleSave?: () => void
  onCopyLink?: () => void
  onClose: () => void
  onBlocked?: () => void
}

export function ContentActionsSheet({
  visible, targetType, targetId, contentOwnerId, contentOwnerName,
  commentPath, isFollowing, onToggleFollow, isSaved, onToggleSave, onCopyLink,
  onClose, onBlocked,
}: Props) {
  const { t } = useI18n()
  const [reportOpen, setReportOpen] = useState(false)
  const menu = t.news.menu

  const confirmBlock = () => {
    if (!contentOwnerId) return
    const target = contentOwnerName ? `@${contentOwnerName}` : 'cet utilisateur'
    Alert.alert(
      menu.blockTitle.replace('{name}', target),
      menu.blockMsg,
      [
        { text: menu.cancel, style: 'cancel' },
        {
          text: menu.block,
          style: 'destructive',
          onPress: async () => {
            const ok = await blockUser(contentOwnerId)
            onClose()
            if (ok) {
              onBlocked?.()
              Alert.alert(menu.blocked, menu.blockSuccess)
            } else {
              Alert.alert(t.news.feed.error, menu.blockError)
            }
          },
        },
      ],
    )
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 }}>
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>

            {onCopyLink && (
              <TouchableOpacity
                onPress={() => { onCopyLink(); onClose() }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 }}
              >
                <Ionicons name="link-outline" size={22} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{menu.copyLink}</Text>
              </TouchableOpacity>
            )}

            {onToggleSave && (
              <TouchableOpacity
                onPress={() => { onToggleSave(); onClose() }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 }}
              >
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={22}
                  color={isSaved ? colors.primary : colors.textPrimary}
                />
                <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
                  {isSaved ? menu.saved : menu.save}
                </Text>
              </TouchableOpacity>
            )}

            {contentOwnerId && onToggleFollow && (
              <TouchableOpacity
                onPress={() => { onToggleFollow(); onClose() }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 }}
              >
                <Ionicons
                  name={isFollowing ? 'person-remove-outline' : 'person-add-outline'}
                  size={22}
                  color={colors.textPrimary}
                />
                <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
                  {isFollowing ? menu.unfollow : t.follow.follow}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => { onClose(); setTimeout(() => setReportOpen(true), 250) }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 }}
            >
              <Ionicons name="flag-outline" size={22} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{menu.report}</Text>
            </TouchableOpacity>

            {contentOwnerId && (
              <TouchableOpacity
                onPress={confirmBlock}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 }}
              >
                <Ionicons name="ban-outline" size={22} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 16 }}>
                  {menu.block}{contentOwnerName ? ` @${contentOwnerName}` : ''}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onClose}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 }}
            >
              <Ionicons name="close-outline" size={22} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>{menu.cancel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ReportModal
        visible={reportOpen}
        targetType={targetType}
        targetId={targetId}
        contentOwnerId={contentOwnerId}
        commentPath={commentPath}
        onClose={() => setReportOpen(false)}
      />
    </>
  )
}
