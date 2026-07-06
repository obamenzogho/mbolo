import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  reportContent, REPORT_REASONS,
  type ReportReason, type ReportTarget,
} from '../services/moderationService'
import { colors } from '../lib/theme'

interface Props {
  visible: boolean
  targetType: ReportTarget
  targetId: string
  contentOwnerId?: string
  commentPath?: string
  onClose: () => void
}

export function ReportModal({ visible, targetType, targetId, contentOwnerId, commentPath, onClose }: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!reason) return
    setSubmitting(true)
    const ok = await reportContent({ targetType, targetId, contentOwnerId, commentPath, reason, details })
    setSubmitting(false)
    onClose()
    setReason(null)
    setDetails('')
    Alert.alert(
      ok ? 'Merci' : 'Erreur',
      ok
        ? 'Ton signalement a été envoyé. Notre équipe va l\'examiner.'
        : 'Impossible d\'envoyer le signalement. Réessaie.',
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 }}>Signaler</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
              Pourquoi signales-tu ce contenu ?
            </Text>

            {REPORT_REASONS.map((r) => (
              <TouchableOpacity
                key={r.key}
                onPress={() => setReason(r.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10, marginBottom: 8,
                  backgroundColor: reason === r.key ? colors.surfaceLight : colors.surface,
                  borderWidth: 1, borderColor: reason === r.key ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15 }}>{r.label}</Text>
                {reason === r.key && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>
            ))}

            {reason === 'other' && (
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Décris le problème..."
                placeholderTextColor={colors.textSecondary}
                multiline
                style={{
                  backgroundColor: colors.surface, color: colors.text, borderRadius: 10,
                  padding: 12, minHeight: 80, textAlignVertical: 'top', marginTop: 4,
                  borderWidth: 1, borderColor: colors.border,
                }}
              />
            )}

            <TouchableOpacity
              onPress={submit}
              disabled={!reason || submitting}
              style={{
                backgroundColor: reason && !submitting ? colors.primary : colors.surfaceLight,
                borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16,
              }}
            >
              <Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>
                {submitting ? 'Envoi...' : 'Envoyer le signalement'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
