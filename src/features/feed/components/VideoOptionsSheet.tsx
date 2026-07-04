/* VideoOptionsSheet — menu "plus d'options" style Instagram.
   Bottom sheet avec options contextuelles (owner vs. autre).
   Signaler, Ne plus voir, Copier le lien, Supprimer, Modifier. */

import { useCallback, useState, useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { doc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'

interface VideoOptionsSheetProps {
  videoId: string
  isOwner: boolean
  onClose: () => void
  sheetRef: React.RefObject<BottomSheet | null>
}

const REPORT_REASONS = [
  { key: 'inappropriate', label: 'Contenu inapproprié', icon: 'alert-circle-outline' as const },
  { key: 'spam', label: 'Spam', icon: 'mail-unread-outline' as const },
  { key: 'harassment', label: 'Harcèlement', icon: 'people-outline' as const },
  { key: 'false_info', label: 'Faux contenu', icon: 'information-circle-outline' as const },
  { key: 'other', label: 'Autre', icon: 'flag-outline' as const },
]

export default function VideoOptionsSheet({ videoId, isOwner, onClose, sheetRef }: VideoOptionsSheetProps) {
  const [showReport, setShowReport] = useState(false)
  const snapPoints = useMemo(() => ['40%', '70%'], [])
  const hasOpenedRef = useRef(false)

  const handleClose = useCallback(() => {
    hasOpenedRef.current = false
    setShowReport(false)
    sheetRef.current?.close()
  }, [sheetRef])

  const handleSheetChange = useCallback((index: number) => {
    if (index >= 0) hasOpenedRef.current = true
    if (index === -1 && hasOpenedRef.current) {
      hasOpenedRef.current = false
      setShowReport(false)
      onClose()
    }
  }, [onClose])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
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
    Alert.alert(
      'Masquer cette vidéo',
      'Vous ne verrez plus ce contenu.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            handleClose()
          },
        },
      ],
    )
  }, [handleClose])

  const handleReport = useCallback((reason: string) => {
    Alert.alert(
      'Signaler cette vidéo',
      'Merci de votre signalement.',
      [
        {
          text: 'OK',
          onPress: async () => {
            try {
              const currentUser = auth.currentUser
              if (!currentUser) return
              await addDoc(collection(db, 'reports'), {
                type: 'video',
                videoId,
                reason,
                reportedBy: currentUser.uid,
                createdAt: serverTimestamp(),
              })
            } catch (e) {
              captureException(e instanceof Error ? e : new Error(String(e)), { context: 'videoOptions:report' })
            }
            handleClose()
          },
        },
      ],
    )
  }, [videoId, handleClose])

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Supprimer la vidéo',
      'Cette action est irréversible.',
      [
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
      ],
    )
  }, [videoId, handleClose])

  if (showReport) {
    return (
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowReport(false)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Signaler</Text>
          <View style={{ width: 28 }} />
        </View>

        {REPORT_REASONS.map((reason) => (
          <TouchableOpacity
            key={reason.key}
            style={styles.optionRow}
            onPress={() => handleReport(reason.key)}
          >
            <Ionicons name={reason.icon} size={22} color="rgba(255,255,255,0.7)" />
            <Text style={styles.optionText}>{reason.label}</Text>
          </TouchableOpacity>
        ))}
      </BottomSheet>
    )
  }

  return (
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
      <View style={styles.optionRow} onStartShouldSetResponder={() => true} onResponderRelease={handleCopyLink}>
        <Ionicons name="link-outline" size={22} color="rgba(255,255,255,0.7)" />
        <Text style={styles.optionText}>Copier le lien</Text>
      </View>

      <View style={styles.separator} />

      <TouchableOpacity style={styles.optionRow} onPress={handleHide}>
        <Ionicons name="eye-off-outline" size={22} color="rgba(255,255,255,0.7)" />
        <Text style={styles.optionText}>Ne plus voir ce contenu</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionRow} onPress={() => setShowReport(true)}>
        <Ionicons name="flag-outline" size={22} color="rgba(255,255,255,0.7)" />
        <Text style={styles.optionText}>Signaler</Text>
      </TouchableOpacity>

      {isOwner && (
        <>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.optionRow} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={22} color="#FF4444" />
            <Text style={[styles.optionText, { color: '#FF4444' }]}>Supprimer la vidéo</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.separator} />

      <TouchableOpacity style={styles.optionRow} onPress={handleClose}>
        <Text style={[styles.optionText, { textAlign: 'center', flex: 0 }]}>Annuler</Text>
      </TouchableOpacity>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#121212',
  },
  handleIndicator: {
    backgroundColor: '#555',
    width: 36,
  },
  handleBar: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  optionText: {
    color: '#FFF',
    fontSize: 15,
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginLeft: 20,
  },
})
