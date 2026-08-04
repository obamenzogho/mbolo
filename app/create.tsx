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
import * as FileSystem from 'expo-file-system/legacy'
import { useI18n } from '@/i18n'
import { getCurrentPlace } from '@/features/location/locationService'
import { PublishProgress } from '@/features/news/components/compose/PublishProgress'
import { VisibilitySheet } from '@/features/news/components/compose/VisibilitySheet'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import { postMotion } from '@/features/news/theme/postTokens'
import type { NewsLocation, NewsPostVisibility } from '@/features/news/types'
import { loadPost } from '@/features/news/services/postMutations'
import { loadVideo } from '@/features/create/services/videoMutations'
import { useCreatePublish, type CreatePublishError, type EditTarget } from '@/features/create/hooks/useCreatePublish'
import { SelectScreen } from '@/features/create/components/SelectScreen'
import { EditScreen } from '@/features/create/components/edit/EditScreen'
import { CaptionScreen } from '@/features/create/components/CaptionScreen'
import { createColors, createType } from '@/features/create/theme/createTokens'
import { CREATE_MAX_MEDIA } from '@/features/create/types'
import type { GalleryAsset } from '@/hooks/useGallery'
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile'

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
  const userProfile = useCurrentUserProfile()

  const {
    mediaUri,
    mediaType,
    editPostId,
    editVideoId,
    sharedUrl,
  } = useLocalSearchParams<{
    mediaUri?: string
    mediaType?: string
    editPostId?: string
    editVideoId?: string
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
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)

  const { publish, update } = useCreatePublish()

  async function cacheRemoteMedia(
    uri: string,
    id: string,
    extension: string,
  ): Promise<string> {
    const base =
      FileSystem.cacheDirectory ??
      FileSystem.documentDirectory

    if (!base) {
      throw new Error('Répertoire cache indisponible')
    }

    const destination = `${base}mbolo-edit-${id}.${extension}`

    const result = await FileSystem.downloadAsync(uri, destination)

    return result.uri
  }

  /* Hydratation à l'arrivée : édition d'un post/vidéo existant, média
     capturé caméra, ou rien. Le partage externe reste non porté. */
  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      if (sharedUrl) {
        Alert.alert(
          t.news.compose.errorTitle,
          t.news.compose.errorUnported,
          [{ text: 'OK', onPress: () => router.back() }],
        )
        return
      }

      if (editPostId) {
        setLoadingExisting(true)

        try {
          const existing = await loadPost(editPostId)

          if (!existing || existing.userId !== auth.currentUser?.uid) {
            throw new Error('Publication inaccessible')
          }

          const localMedia = await Promise.all(
            existing.media.map(async (item, index) => ({
              uri: await cacheRemoteMedia(
                item.url,
                `${editPostId}-${index}`,
                item.type === 'video' ? 'mp4' : 'jpg',
              ),
              type: item.type === 'video' ? 'video' as const : 'image' as const,
              width: item.width,
              height: item.height,
              duration: item.duration ?? null,
            })),
          )

          if (cancelled) return

          setEditTarget({ kind: 'post', id: editPostId })
          setMedia(localMedia)
          setText(existing.text)
          setVisibility(existing.visibility)
          setCommentsEnabled(existing.commentsEnabled)
          setEditingIndex(0)
          setStep(localMedia.length > 0 ? 'edit' : 'caption')
        } catch {
          Alert.alert(
            'Erreur',
            'Impossible de charger cette publication.',
            [{ text: 'OK', onPress: () => router.back() }],
          )
        } finally {
          if (!cancelled) setLoadingExisting(false)
        }

        return
      }

      if (editVideoId) {
        setLoadingExisting(true)

        try {
          const existing = await loadVideo(editVideoId)

          if (!existing || existing.userId !== auth.currentUser?.uid) {
            throw new Error('Vidéo inaccessible')
          }

          const localUri = await cacheRemoteMedia(
            existing.videoURL,
            editVideoId,
            'mp4',
          )

          if (cancelled) return

          setEditTarget({ kind: 'video', id: editVideoId })
          setMedia([
            {
              uri: localUri,
              type: 'video',
              thumbnailUri: existing.thumbnailURL,
              duration: existing.durationMs ?? null,
            },
          ])
          setText(existing.description)
          setVisibility(existing.visibility)
          setCommentsEnabled(existing.commentsEnabled)
          setEditingIndex(0)
          setStep('edit')
        } catch {
          Alert.alert(
            'Erreur',
            'Impossible de charger cette vidéo.',
            [{ text: 'OK', onPress: () => router.back() }],
          )
        } finally {
          if (!cancelled) setLoadingExisting(false)
        }

        return
      }

      if (!mediaUri) return

      setMedia([
        {
          uri: mediaUri,
          type: mediaType === 'video' ? 'video' : 'image',
        },
      ])
      setEditingIndex(0)
      setStep('edit')
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [mediaUri, mediaType, editPostId, editVideoId, sharedUrl, router, t])

  const selected = media[0] ?? null
  const hasContent = media.length > 0 || text.trim().length > 0
  const isCaptionStep = step === 'caption'
  const isEditStep = step === 'edit'
  const isPublishing = step === 'publishing'

  /* Instagram distingue la sélection simple (remplace l'aperçu) et la
     sélection multiple. Une vidéo est toujours seule : le renderer et le
     feed n'acceptent pas de carrousel mixte photo/vidéo. */
  const handleSelectAsset = useCallback((asset: GalleryAsset, multiple: boolean) => {
    setMedia((prev) => {
      const idx = prev.findIndex((m) => m.uri === asset.uri)
      if (multiple && idx !== -1) {
        return prev.filter((_, i) => i !== idx)
      }
      const isVideo = asset.mediaType === 'video'
      const selectedAsset: SelectedMedia = {
        uri: asset.uri,
        type: isVideo ? 'video' : 'image',
        width: asset.width,
        height: asset.height,
        duration: asset.duration ?? null,
      }

      if (!multiple || isVideo || prev.some((item) => item.type === 'video')) {
        return [selectedAsset]
      }
      if (prev.length >= CREATE_MAX_MEDIA) return prev
      return [...prev, selectedAsset]
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

  const handleAltTextChange = useCallback((index: number, altText: string) => {
    setMedia((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], altText }
      return next
    })
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

    const author = {
      uid: user.uid,
      displayName:
        user.displayName || user.email?.split('@')[0] || t.news.compose.userFallback,
    }
    const draft = { text, media, visibility, commentsEnabled, location }

    const outcome = editTarget
      ? await update(editTarget, draft, author, { onProgress: setProgress })
      : await publish(draft, author, { onProgress: setProgress })

    if (typeof outcome === 'object') {
      router.back()
      return
    }

    setStep('caption')
    handleError(outcome)
  }, [user, text, media, visibility, commentsEnabled, location, editTarget, publish, update, router, t, handleError])

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

  const headerColor = createColors

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

  const hideHeader = step === 'select' && mode === 'camera'

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* En-tête du flux : masqué en mode caméra plein écran. */}
        {!hideHeader ? (
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
        ) : null}

        {step === 'select' ? (
          <SelectScreen
            media={media}
            mode={mode}
            onModeChange={setMode}
            onSelectAsset={handleSelectAsset}
            onCapture={handleCapture}
            onPickText={startTextPost}
            onNext={handleRightPress}
            nextLabel={rightLabel}
            nextDisabled={rightDisabled}
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
            userName={userProfile.nom}
            userPhotoURL={userProfile.photoURL}
            onAltTextChange={handleAltTextChange}
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
  /* screenLight supprimé : tout le flux est sombre. */
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
