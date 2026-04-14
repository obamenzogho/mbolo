/* VideoOptionsSheet — menu "plus d'options" style Instagram. */

import { useCallback, useState, useMemo, useRef } from 'react'
import { View, Text, Alert, StyleSheet } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { doc, deleteDoc } from 'firebase/firestore'
import { db, auth } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import { colors } from '../../../lib/theme'
import { ReportModal } from '../../../components/ReportModal'
import { blockUser } from '../../../services/moderationService'

interface VideoOptionsSheetProps {
  videoId: string
  isOwner: boolean
  contentOwnerId?: string
  contentOwnerName?: string
  onClose: () => void
  sheetRef: React.RefObject<BottomSheet | null>
}

export default function VideoOptionsSheet({ videoId, isOwner, contentOwnerId, contentOwnerName, onClose, sheetRef }: VideoOptionsSheetProps) {
  const [reportOpen, setReportOpen] = useState(false)
  const snapPoints = useMemo(() => ['40%', '70%'], [])
  const hasOpenedRef = useRef(false)

  const handleClose = useCallback(() => {
    hasOpenedRef.current = false
    setReportOpen(false)
    sheetRef.current?.close()
  }, [sheetRef])

  const handleSheetChange = useCallback((index: number) => {
    if (index >= 0) hasOpenedRef.current = true
    if (index === -1 && hasOpenedRef.current) {
      hasOpenedRef.current = false
      setReportOpen(false)
      onClose()
    }
  }, [onClose])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} pressBehavior="close" />
    ),
    [],
  )

  const handleCopyLink = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(`https://mbolo.app/post/${videoId}`)
      handleClose()
    } catch (e) {
      captureException(e instanceof Error ? e : new Error(String(e)), { context: 'videoOptions:copyLink' })
    }
  }, [videoId, handleClose])

  const handleHide = useCallback(() => {
    Alert.alert('Masquer cette vidéo', 'Vous ne verrez plus ce contenu.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: () => handleClose() },
    ])
  }, [handleClose])

  const handleDelete = useCallback(() => {
    Alert.alert('Supprimer la vidéo', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'videos', videoId))
          } catch (e) {
            captureException(e instanceof Error ? e : new Error(String(e)), { context: 'videoOptions:delete' })
          }
          handleClose()
        },
      },
    ])
  }, [videoId, handleClose])

  const handleBlock = useCallback(() => {
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
            handleClose()
            if (ok) {
              Alert.alert('Bloqué', 'Cet utilisateur a été bloqué.')
            } else {
              Alert.alert('Erreur', 'Impossible de bloquer. Réessaie.')
            }
          },
        },
      ],
    )
  }, [contentOwnerId, contentOwnerName, handleClose])

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handleBar}
        onChange={handleSheetChange}
      >
        <TouchableOpacity style={styles.optionRow} onPress={handleCopyLink}>
          <Ionicons name="link-outline" size={22} color={colors.textOnMedia} />
          <Text style={styles.optionText}>Copier le lien</Text>
        </TouchableOpacity>

        <View style={styles.separator} />

        <TouchableOpacity style={styles.optionRow} onPress={handleHide}>
          <Ionicons name="eye-off-outline" size={22} color={colors.textOnMedia} />
          <Text style={styles.optionText}>Ne plus voir ce contenu</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={() => { setReportOpen(true) }}>
          <Ionicons name="flag-outline" size={22} color={colors.textOnMedia} />
          <Text style={styles.optionText}>Signaler</Text>
        </TouchableOpacity>

        {!isOwner && contentOwnerId && (
          <TouchableOpacity style={styles.optionRow} onPress={handleBlock}>
            <Ionicons name="ban-outline" size={22} color="#ef4444" />
            <Text style={[styles.optionText, { color: '#ef4444' }]}>Bloquer @{contentOwnerName || ''}</Text>
          </TouchableOpacity>
        )}

        {isOwner && (
          <>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.optionRow} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color={colors.error} />
              <Text style={[styles.optionText, { color: colors.error }]}>Supprimer la vidéo</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.separator} />

        <TouchableOpacity style={styles.optionRow} onPress={handleClose}>
          <Text style={[styles.optionText, { textAlign: 'center', flex: 0 }]}>Annuler</Text>
        </TouchableOpacity>
      </BottomSheet>

      <ReportModal
        visible={reportOpen}
        targetType="video"
        targetId={videoId}
        contentOwnerId={contentOwnerId}
        onClose={() => { setReportOpen(false); handleClose() }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  background: { backgroundColor: colors.surface },
  handleIndicator: { backgroundColor: colors.textSecondary, width: 36 },
  handleBar: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  backBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.hairline, justifyContent: 'center', alignItems: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 },
  optionText: { color: colors.text, fontSize: 15, flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: 20 },
})
