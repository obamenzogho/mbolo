/* app/create.tsx — Nouveau flux de création unifié (post / vidéo).

   Port du prototype createPost-instagram : écosystème sombre à la sélection,
   écran clair à la légende, publication via useCreatePublish (photo/texte →
   `posts`, vidéo → `videos`, rendu final : le feed n'applique aucun montage).

   Remplace l'ancien composeur riche et le legacy video-editor : c'est
   désormais le seul chemin de création. */

import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { auth } from '@/lib/firebase'
import { useI18n } from '@/i18n'
import { getCurrentPlace } from '@/features/location/locationService'
import { PublishProgress } from '@/features/news/components/compose/PublishProgress'
import { VisibilitySheet } from '@/features/news/components/compose/VisibilitySheet'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import { postMotion } from '@/features/news/theme/postTokens'
import type { NewsLocation, NewsPostVisibility } from '@/features/news/types'
import { useCreatePublish, type CreatePublishError } from '@/features/create/hooks/useCreatePublish'
import { SelectScreen } from '@/features/create/components/SelectScreen'
import { EditScreen } from '@/features/create/components/edit/EditScreen'
import { CaptionScreen } from '@/features/create/components/CaptionScreen'
import { createColors, captionColors, createType } from '@/features/create/theme/createTokens'
import type { GalleryAsset } from '@/hooks/useGallery'

type Step = 'select' | 'edit' | 'caption' | 'publishing'

const ERROR_KEYS: Record<CreatePublishError, string> = {
  upload: 'errorUpload',
  write: 'errorWrite',
  auth: 'errorAuth',
  render: 'errorPublish',
  rateLimit: 'errorRateLimit',
}

export default function CreateScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const user = auth.currentUser

  /* Depuis la caméra : on arrive média en main, on va droit à la légende.
     `editPostId` / `sharedUrl` (anciens chemins du composeur) ne sont pas
     encore portés : on le dit clairement plutôt que de laisser un écran vide. */
  const { mediaUri, mediaType, editPostId, sharedUrl } = useLocalSearchParams<{
    mediaUri?: string
    mediaType?: string
    editPostId?: string
    sharedUrl?: string
  }>()

  const [step, setStep] = useState<Step>('select')
  const [mode, setMode] = useState<'gallery' | 'camera'>('gallery')
  const [media, setMedia] = useState<SelectedMedia[]>([])
  const [editingIndex, setEditingIndex] = useState(0)
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState<NewsPostVisibility>('public')
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [location, setLocation] = useState<NewsLocation | null>(null)
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [progress, setProgress] = useState(0)

  const { publish } = useCreatePublish()

  /* Média capturé avant l'arrivée (caméra) : pré-rempli, on saute le choix. */
  useEffect(() => {
    if (editPostId || sharedUrl) {
      Alert.alert(
        t.news.compose.errorTitle,
        t.news.compose.errorUnported,
        [{ text: 'OK', onPress: () => router.back() }],
      )
      return
    }
    if (!mediaUri) return
    setMedia([{ uri: mediaUri, type: mediaType === 'video' ? 'video' : 'image' }])
    setStep('caption')
  }, [mediaUri, mediaType, editPostId, sharedUrl, router, t])

  const selected = media[0] ?? null
  const hasContent = media.length > 0 || text.trim().length > 0
  const isCaptionStep = step === 'caption'
  const isEditStep = step === 'edit'
  const isPublishing = step === 'publishing'

  /* Sélection multiple : add/remove avec cap à 4 médias. L'ordre d'ajout
     détermine la numérotation (1, 2, 3, 4) affichée dans la grille. */
  const handleToggle = useCallback((asset: GalleryAsset) => {
    setMedia((prev) => {
      const idx = prev.findIndex((m) => m.uri === asset.uri)
      if (idx !== -1) {
        /* Déjà sélectionné → retrait. */
        return prev.filter((_, i) => i !== idx)
      }
      if (prev.length >= 4) {
        /* Cap atteint : on ignore le tap. */
        return prev
      }
      /* Ajout à la fin. */
      const isVideo = asset.mediaType === 'video'
      return [
        ...prev,
        {
          uri: asset.uri,
          type: isVideo ? 'video' : 'image',
          width: asset.width,
          height: asset.height,
          duration: asset.duration ?? null,
        },
      ]
    })
  }, [])

  const handleCapture = useCallback((captured: SelectedMedia) => {
    setMedia([captured])
    setEditingIndex(0)
    setStep('edit')
  }, [])

  const startTextPost = useCallback(() => {
    setMedia([])
    setText('')
    setStep('caption')
  }, [])

  const detectLocation = useCallback(async () => {
    setDetectingLocation(true)
    try {
      const place = await getCurrentPlace()
      if (place) {
        setLocation({
          name: place.city || place.country || 'Mbolo',
          lat: place.lat,
          lng: place.lng,
        })
      }
    } catch {
      Alert.alert(t.news.compose.errorTitle, t.news.compose.errorLocation)
    } finally {
      setDetectingLocation(false)
    }
  }, [t])

  const handleError = useCallback(
    (reason: CreatePublishError) => {
      Alert.alert(
        t.news.compose.errorTitle,
        t.news.compose[ERROR_KEYS[reason] as keyof typeof t.news.compose],
      )
    },
    [t],
  )

  const handlePublish = useCallback(async () => {
    if (!user) {
      handleError('auth')
      return
    }

    setStep('publishing')
    setProgress(0)

    const outcome = await publish(
      { text, media, visibility, commentsEnabled, location },
      {
        uid: user.uid,
        displayName:
          user.displayName || user.email?.split('@')[0] || t.news.compose.userFallback,
      },
      { onProgress: setProgress },
    )

    if (typeof outcome === 'object') {
      router.back()
      return
    }

    setStep('caption')
    handleError(outcome)
  }, [user, text, media, visibility, commentsEnabled, location, publish, router, t, handleError])

  const handleBack = useCallback(() => {
    if (step === 'caption') {
      setStep('edit')
      return
    }
    if (step === 'edit') {
      setStep('select')
      return
    }
    router.back()
  }, [step, router])

  const headerColor = isCaptionStep ? captionColors : createColors

  /* Titre de l'en-tête selon l'étape. */
  const headerTitle = isEditStep
    ? 'Édition'
    : t.news.compose.createTitle

  /* Icône du bouton retour : close en sélection, flèche sinon. */
  const backIcon = step === 'select' ? 'close' : 'arrow-back'

  /* Comportement du bouton droit. */
  const handleRightPress = useCallback(() => {
    if (isCaptionStep) {
      handlePublish()
    } else if (isEditStep) {
      setStep('caption')
    } else {
      /* select → edit */
      setEditingIndex(0)
      setStep('edit')
    }
  }, [isCaptionStep, isEditStep, handlePublish])

  const rightDisabled = isCaptionStep ? !hasContent : isEditStep ? false : media.length === 0
  const rightLabel = isCaptionStep
    ? t.news.compose.publish
    : t.news.compose.next

  return (
    <View style={[styles.screen, isCaptionStep && styles.screenLight]}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* En-tête du flux : sombre à la sélection/édition, clair à la légende. */}
        <View style={[styles.header, { borderBottomColor: headerColor.hairline }]}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            accessibilityRole="button"
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          >
            <Ionicons
              name={backIcon}
              size={26}
              color={headerColor.textPrimary}
            />
          </Pressable>

          <Text
            style={[
              styles.headerTitle,
              createType.title,
              { color: headerColor.textPrimary },
            ]}
            numberOfLines={1}
          >
            {headerTitle}
          </Text>

          <Pressable
            onPress={handleRightPress}
            disabled={rightDisabled}
            accessibilityRole="button"
            style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
          >
            <Text
              style={[
                styles.headerAction,
                rightDisabled && styles.headerActionDisabled,
              ]}
            >
              {rightLabel}
            </Text>
          </Pressable>
        </View>

        {step === 'select' ? (
          <SelectScreen
            media={media}
            mode={mode}
            onModeChange={setMode}
            onToggle={handleToggle}
            onCapture={handleCapture}
            onPickText={startTextPost}
          />
        ) : isEditStep && media[editingIndex] ? (
          <EditScreen
            media={media[editingIndex]}
            onMediaChange={(updated) => {
              setMedia((prev) => {
                const next = [...prev]
                next[editingIndex] = updated
                return next
              })
            }}
          />
        ) : isPublishing ? (
          <PublishProgress progress={progress} />
        ) : (
          <CaptionScreen
            media={media}
            text={text}
            onChangeText={setText}
            visibility={visibility}
            onPressVisibility={() => setVisibilityOpen(true)}
            commentsEnabled={commentsEnabled}
            onToggleComments={() => setCommentsEnabled((v) => !v)}
            location={location}
            detectingLocation={detectingLocation}
            onPressLocation={location ? () => setLocation(null) : detectLocation}
          />
        )}
      </SafeAreaView>

      <VisibilitySheet
        visible={visibilityOpen}
        value={visibility}
        onChange={setVisibility}
        onClose={() => setVisibilityOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: createColors.canvas },
  screenLight: { backgroundColor: captionColors.canvas },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    minWidth: 42,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: postMotion.pressedOpacity },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerAction: {
    color: createColors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  headerActionDisabled: { color: createColors.textTertiary },
})
