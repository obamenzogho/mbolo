import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { blockUser } from '../services/moderationService'
import { ReportModal } from './ReportModal'
import type { ReportTarget } from '../services/moderationService'
import { colors } from '../lib/theme'

interface Props {
  visible: boolean
  targetType: ReportTarget
  targetId: string
  contentOwnerId?: string
  contentOwnerName?: string
  commentPath?: string
  onClose: () => void
  onBlocked?: () => void
}

export function ContentActionsSheet({
  visible, targetType, targetId, contentOwnerId, contentOwnerName,
  commentPath, onClose, onBlocked,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false)

  const confirmBlock = () => {
    if (!contentOwnerId) return
    Alert.alert(
      `Bloquer @${contentOwnerName || 'cet utilisateur'} ?`,
      'Vous ne verrez plus son contenu et il ne pourra plus voir le vôtre ni vous contacter.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: async () => {
            const ok = await blockUser(contentOwnerId)
            onClose()
            if (ok) {
              onBlocked?.()
              Alert.alert('Bloqué', 'Cet utilisateur a été bloqué.')
            } else {
              Alert.alert('Erreur', 'Impossible de bloquer. Réessaie.')
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

            <TouchableOpacity
              onPress={() => { onClose(); setTimeout(() => setReportOpen(true), 250) }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 }}
            >
              <Ionicons name="flag-outline" size={22} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 16 }}>Signaler</Text>
            </TouchableOpacity>

            {contentOwnerId && (
              <TouchableOpacity
                onPress={confirmBlock}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 }}
              >
                <Ionicons name="ban-outline" size={22} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontSize: 16 }}>
                  Bloquer{contentOwnerName ? ` @${contentOwnerName}` : ''}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onClose}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20 }}
            >
              <Ionicons name="close-outline" size={22} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Annuler</Text>
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
