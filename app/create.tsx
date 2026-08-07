/* app/create.tsx — Nouveau flux de création unifié (post / vidéo).

   Port du prototype createPost-instagram : écosystème sombre à la sélection,
   écran clair à la légende, publication via useCreatePublish (photo/texte →
   `posts`, vidéo → `videos`, rendu final : le feed n'applique aucun montage).

   Remplace l'ancien composeur riche et le legacy video-editor : c'est
   désormais le seul chemin de création. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as MediaLibrary from 'expo-media-library'
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
import { SoundPickerSheet } from '@/features/create/components/SoundPickerSheet'
import { LocationSheet } from '@/features/create/components/LocationSheet'
import { createColors, createType } from '@/features/create/theme/createTokens'
import { CREATE_MAX_MEDIA } from '@/features/create/types'
import type { GalleryAsset } from '@/hooks/useGallery'
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile'

type Step = 'select' | 'edit' | 'caption' | 'publishing'

/* Onglets de la modale de création (style Instagram) : Publication photo /
   texte, Reel vidéo, Story (flux dédié existant). */
/* Flux de création unifié : Publication (photo/texte) et Reel vidéo. La
   Story est volontairement absente — son flux dédié doit être recodé en
   mode Instagram avant d'être réactivé. */
type CreateTab = 'post' | 'reel'

/* 'cancelled' est géré séparément (retour à la légende, pas d'alerte). */
const ERROR_KEYS: Record<Exclude<CreatePublishError, 'cancelled'>, string> = {
  upload: 'errorUpload',
  write: 'errorWrite',
  auth: 'errorAuth',
  render: 'errorPublish',
  rateLimit: 'errorRateLimit',
}

export default function CreateScreen() {
  const router = useRouter()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const user = auth.currentUser
  const userProfile = useCurrentUserProfile()

  /* Onglets de la modale (labels i18n — le nom de l'onglet est fixé ici). */
  /* Onglets de la modale (labels i18n — le nom de l'onglet est fixé ici).
     Mémorisé car `t` peut changer de langue : la liste t-à-t-elle stable tant
     que la langue ne change pas. */
  const CREATE_TABS: { id: CreateTab; label: string }[] = useMemo(
    () => [
      { id: 'post', label: t.news.compose.createTabPost },
      { id: 'reel', label: t.news.compose.createTabReel },
    ],
    [t.news.compose.createTabPost, t.news.compose.createTabReel],
  )

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
  const [tab, setTab] = useState<CreateTab>('post')
  const [mode, setMode] = useState<'gallery' | 'camera'>('gallery')
  const [media, setMedia] = useState<SelectedMedia[]>([])
  const [editingIndex, setEditingIndex] = useState(0)
  const [text, setText] = useState('')
  const [visibility, setVisibility] = useState<NewsPostVisibility>('public')
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [hideMentionsAndHashtags, setHideMentionsAndHashtags] = useState(false)
  const [location, setLocation] = useState<NewsLocation | null>(null)
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [locationOpen, setLocationOpen] = useState(false)
  const [soundPickerOpen, setSoundPickerOpen] = useState(false)
  const [soundId, setSoundId] = useState<string | undefined>(undefined)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [progress, setProgress] = useState(0)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)

  const { publish, update, cancel } = useCreatePublish()

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
          setHideMentionsAndHashtags(existing.hideMentionsAndHashtags === true)
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
          setHideMentionsAndHashtags(existing.hideMentionsAndHashtags === true)
          setSoundId(existing.soundId ?? undefined)
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

  /* Le son n'a de sens que sur une vidéo unique : un carrousel (photo ou
     vidéo) repart sans piste de bibliothèque. Valeur dérivée — jamais
     de setState dans un effet. */
  const activeSoundId = media.length === 1 && media[0].type === 'video' ? soundId : undefined

  /* Instagram distingue la sélection simple (remplace l'aperçu) et la
     sélection multiple. Un carrousel est homogène (photos OU vidéos) :
     le renderer et le feed n'acceptent pas de carrousel mixte photo/vidéo.
     Changer de type pendant une sélection multiple vide la sélection. */
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

      if (!multiple) return [selectedAsset]
      if (prev.length >= CREATE_MAX_MEDIA) return prev
      if (prev.length > 0 && prev.some((item) => item.type !== selectedAsset.type)) {
        return [selectedAsset]
      }
      return [...prev, selectedAsset]
    })
  }, [])

  /* Une rafale caméra remonte plusieurs clichés d'un coup : on borne au
     nombre de médias qu'un carrousel accepte. En mode Reel, seule une
     vidéo est recevable (Instagram : l'onglet Reel ne crée que des vidéos). */
  const handleCapture = useCallback((captured: SelectedMedia[]) => {
    if (captured.length === 0) return
    const keep = tab === 'reel' ? captured.filter((c) => c.type === 'video') : captured
    if (tab === 'reel' && keep.length === 0) {
      Alert.alert(t.news.compose.errorTitle, t.news.compose.reelOnlyVideo)
      return
    }
    setMedia(keep.slice(0, CREATE_MAX_MEDIA))
    setEditingIndex(0)
    setStep('edit')
  }, [tab, t])

  /* Bascule d'onglet : la sélection est propre à chaque onglet, et le mode
     caméra/galerie est conservé (un swipe depuis la caméra reste en caméra,
     en basculant le type photo↔vidéo). */
  const handleTabChange = useCallback((next: CreateTab) => {
    if (next === tab) return
    setTab(next)
    setMedia([])
    setText('')
    setSoundId(undefined)
    setStep('select')
  }, [tab])

  /* Swipe horizontal sur la barre d'onglets → bascule post↔reel
     (comportement Instagram : glisser la page change d'onglet). */
  const TAB_ORDER = useMemo(() => CREATE_TABS.map((e) => e.id), [CREATE_TABS])
  const swipeThreshold = 40
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) >= 4,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) >= 4,
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < swipeThreshold) return
          const currentIndex = TAB_ORDER.indexOf(tab)
          const nextIndex = gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1
          const next = TAB_ORDER[nextIndex]
          /* La Story navigue vers son propre flux via handleTabChange. */
          if (next) handleTabChange(next)
        },
      }),
    [TAB_ORDER, handleTabChange, tab],
  )

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
        /* Lieu trouvé : on referme la feuille, l'utilisateur le voit sur
           la rangée de la légende. */
        setLocationOpen(false)
      }
    } catch {
      Alert.alert(t.news.compose.errorTitle, t.news.compose.errorLocation)
    } finally {
      setDetectingLocation(false)
    }
  }, [t])

  const handleError = useCallback(
    (reason: CreatePublishError) => {
      /* Annulation : traité par l'appelant, jamais ici. */
      if (reason === 'cancelled') return
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
    const draft = { text, media, visibility, commentsEnabled, hideMentionsAndHashtags, location, soundId: activeSoundId }

    const outcome = editTarget
      ? await update(editTarget, draft, author, { onProgress: setProgress })
      : await publish(draft, author, { onProgress: setProgress })

    if (typeof outcome === 'object') {
      router.back()
      return
    }

    /* Annulation utilisateur : le brouillon est intact, on reste sur la
       légende sans message d'erreur. */
    if (outcome === 'cancelled') {
      setStep('caption')
      return
    }

    setStep('caption')
    handleError(outcome)
  }, [user, text, media, visibility, commentsEnabled, hideMentionsAndHashtags, location, activeSoundId, editTarget, publish, update, router, t, handleError])

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
    <View style={styles.screen} {...panResponder.panHandlers}>
      <SafeAreaView edges={hideHeader ? [] : ['top']} style={styles.safe}>
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

        {/* Onglets Publication / Reel / Story, visibles à la sélection.
            En mode caméra, la barre est en overlay (absolute) par-dessus le
            flux vidéo, avec un fond translucide et le padding safe area. */}
        {step === 'select' ? (
          <View
            style={[
              styles.tabsBar,
              hideHeader && [
                styles.tabsBarCamera,
                { paddingTop: insets.top + 6 },
              ],
            ]}
            {...panResponder.panHandlers}
          >
            {CREATE_TABS.map((entry) => {
              const active = entry.id === tab
              /* En mode caméra, l'onglet Publication devient « Photo » :
                 c'est là qu'on capture une photo (Reel reste la vidéo). */
              const label =
                entry.id === 'post' && mode === 'camera'
                  ? t.news.compose.createTabPhoto
                  : entry.label
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => handleTabChange(entry.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.tabBtn, pressed && styles.pressed]}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      active && styles.tabLabelActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}

        {step === 'select' ? (
          <SelectScreen
            media={media}
            mode={mode}
            onModeChange={setMode}
            onSelectAsset={handleSelectAsset}
            onCapture={handleCapture}
            onPickText={tab === 'reel' ? undefined : startTextPost}
            onNext={handleRightPress}
            nextLabel={rightLabel}
            nextDisabled={rightDisabled}
            mediaTypes={
              tab === 'reel'
                ? [MediaLibrary.MediaType.video]
                : [MediaLibrary.MediaType.photo]
            }
            captureMode={tab === 'reel' ? 'video' : 'picture'}
            soundId={activeSoundId}
            onOpenSound={() => setSoundPickerOpen(true)}
            onClearSound={() => setSoundId(undefined)}
            onHorizontalSwipe={(direction) => {
              const currentIndex = TAB_ORDER.indexOf(tab)
              const nextIndex = direction === 'left' ? currentIndex + 1 : currentIndex - 1
              const next = TAB_ORDER[nextIndex]
              if (next) handleTabChange(next)
            }}
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
          <PublishProgress progress={progress} onCancel={cancel} />
        ) : (
          <CaptionScreen
            media={media}
            text={text}
            onChangeText={setText}
            visibility={visibility}
            onPressVisibility={() => setVisibilityOpen(true)}
            commentsEnabled={commentsEnabled}
            onToggleComments={() => setCommentsEnabled((v) => !v)}
            hideMentionsAndHashtags={hideMentionsAndHashtags}
            onToggleHideMentions={() => setHideMentionsAndHashtags((v) => !v)}
            location={location}
            detectingLocation={detectingLocation}
            onPressLocation={() => setLocationOpen(true)}
            soundId={activeSoundId}
            onPressSound={() => setSoundPickerOpen(true)}
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
      <SoundPickerSheet
        visible={soundPickerOpen}
        selectedSoundId={activeSoundId}
        onSelect={(selected) => {
          setSoundId(selected?.id)
          setSoundPickerOpen(false)
        }}
        onClose={() => setSoundPickerOpen(false)}
      />
      <LocationSheet
        visible={locationOpen}
        value={location}
        detecting={detectingLocation}
        onDetect={detectLocation}
        onSelect={(next) => {
          setLocation(next)
          setLocationOpen(false)
        }}
        onClose={() => setLocationOpen(false)}
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

  /* Barre d'onglets Publication / Reel / Story (style Instagram). */
  tabsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: createColors.hairline,
  },
  tabBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: createColors.textTertiary,
  },
   tabLabelActive: {
    color: createColors.textPrimary,
    fontWeight: '700',
  },
  /* En mode caméra (header masqué) : barre d’onglets collée au haut, fond
     translucide noir pour garder les libellés lisibles sur l’aperçu vidéo
     (le swipe est géré par `panResponder` sur ce conteneur). */
  tabsBarCamera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomColor: 'rgba(255, 255, 255, 0.18)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
