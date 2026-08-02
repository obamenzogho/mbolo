/* app/news-compose.tsx

   Écran unique de création : texte, photo, vidéo, article, sondage et
   partage de vidéo passent tous par ici. Le fichier n'est qu'un
   orchestrateur — l'état vit dans useComposeState, la persistance locale
   dans useComposeDraft, l'écriture distante dans useComposePublish, et
   chaque bloc visuel dans components/compose/.

   Deux axes seulement gouvernent l'affichage :

     mode : galerie | caméra | texte | sondage   ← les onglets du haut
     step : pick | details                        ← galerie et caméra seules

   L'écran ouvre sur la galerie, comme Instagram : dans la plupart des cas
   la publication existe déjà dans le téléphone, la demander en premier
   supprime une étape. Les onglets disparaissent à l'étape de finalisation —
   changer de mode y reviendrait à jeter le travail en cours. En édition on
   entre directement en « details » : on ne rechoisit pas un média pour
   corriger une légende. */

import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import * as VideoThumbnails from 'expo-video-thumbnails'
import PageWrapper from '@/components/PageWrapper'
import OrbitLoader from '@/components/OrbitLoader'
import { auth } from '@/lib/firebase'
import { captureException } from '@/lib/sentry'
import { useCurrentUserPhoto } from '@/hooks/useCurrentUserPhoto'
import { useHaptics } from '@/hooks/useHaptics'
import type { GalleryAsset } from '@/hooks/useGallery'
import { useI18n } from '@/i18n'
import { ComposeCamera } from '@/features/news/components/compose/ComposeCamera'
import { ComposeDetails } from '@/features/news/components/compose/ComposeDetails'
import { ComposeHeader } from '@/features/news/components/compose/ComposeHeader'
import { ComposeModeTabs } from '@/features/news/components/compose/ComposeModeTabs'
import type { ComposeMode } from '@/features/news/components/compose/ComposeModeTabs'
import { DraftBanner } from '@/features/news/components/compose/DraftBanner'
import { GalleryGrid } from '@/features/news/components/compose/GalleryGrid'
import { MoodSheet } from '@/features/news/components/compose/MoodSheet'
import { PublishProgress } from '@/features/news/components/compose/PublishProgress'
import { VisibilitySheet } from '@/features/news/components/compose/VisibilitySheet'
import { VideoPickerModal } from '@/features/news/components/VideoPickerModal'
import { clearComposeDraft, useComposeDraft } from '@/features/news/hooks/useComposeDraft'
import {
  EMPTY_COMPOSE,
  composeSnapshot,
  useComposeState,
} from '@/features/news/hooks/useComposeState'
import type { ComposeState, SelectedMedia } from '@/features/news/hooks/useComposeState'
import { useComposePublish } from '@/features/news/hooks/useComposePublish'
import type { PublishError } from '@/features/news/hooks/useComposePublish'
import { loadPost, type PostDraft } from '@/features/news/services/postMutations'
import type { NewsPost } from '@/features/news/types'
import { newsFeedStore } from '@/features/news/store/newsFeedStore'
import { COMPOSE_MAX_MEDIA, postColors } from '@/features/news/theme/postTokens'
import type { Video as VideoType } from '@/types'

const EMPTY_SNAPSHOT = composeSnapshot(EMPTY_COMPOSE)

/** Aperçu du brouillon dans la bannière : premier contenu textuel trouvé. */
function draftPreview(state: ComposeState): string {
  return (
    state.text.trim() ||
    state.article?.title.trim() ||
    state.poll?.question.trim() ||
    ''
  ).slice(0, 60)
}

/* Post édité → état du composeur. Les URI distantes du document deviennent
   les « médias » du formulaire, exactement comme en création ; le type du
   média est resanitisé (une valeur inconnue retombe sur une image). */
function postToComposeState(post: NewsPost): ComposeState {
  return {
    text: post.text,
    media: post.media.map((item) => ({
      uri: item.url,
      type: item.type === 'video' ? 'video' : 'image',
      width: item.width,
      height: item.height,
      duration: item.duration ?? null,
      thumbnailUri: item.thumbnailUrl,
    })),
    visibility: post.visibility,
    commentsEnabled: post.commentsEnabled,
    background: post.background ?? 'none',
    location: post.location ?? null,
    mood: post.mood ?? null,
    poll: post.poll ?? null,
    article: post.article
      ? {
          title: post.article.title,
          body: post.article.body,
          coverImage: post.article.coverImage ?? null,
        }
      : null,
    sharedVideo: post.videoShare ?? null,
  }
}

export default function NewsComposeScreen() {
  const { editPostId, sharedUrl } = useLocalSearchParams<{
    editPostId?: string
    sharedUrl?: string
  }>()
  const editing = Boolean(editPostId)

  const { t } = useI18n()
  const { lightImpact } = useHaptics()

  const { state, dispatch, setText, snapshot, canPublish, canUseBackground, hasContent } =
    useComposeState()

  const [mode, setMode] = useState<ComposeMode>('gallery')
  const [step, setStep] = useState<'pick' | 'details'>(editing ? 'details' : 'pick')
  const [loadingPost, setLoadingPost] = useState(editing)
  const [baseline, setBaseline] = useState(EMPTY_SNAPSHOT)
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [moodOpen, setMoodOpen] = useState(false)
  const [videoPickerOpen, setVideoPickerOpen] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)

  const user = auth.currentUser
  const photoURL = useCurrentUserPhoto()

  /* Les modes texte et sondage n'ont pas d'étape de choix : ils composent
     directement. La galerie et la caméra choisissent d'abord un média. */
  const inDetails = step === 'details' || mode === 'text' || mode === 'poll'

  const handleSuccess = useCallback(
    (postId: string, draft: PostDraft) => {
      // En édition, le fil est déjà chargé : on le met à jour sur place plutôt
      // que d'attendre un aller-retour Firestore.
      if (editing) {
        newsFeedStore.getState().updatePost(postId, {
          text: draft.text.trim(),
          format: draft.format,
          media: draft.media,
          visibility: draft.visibility,
          commentsEnabled: draft.commentsEnabled,
          background: draft.background,
          location: draft.location ?? undefined,
          mood: draft.mood ?? undefined,
          poll: draft.poll ?? undefined,
          article: draft.article ?? undefined,
          videoShare: draft.videoShare ?? undefined,
        })
      }

      clearComposeDraft()
      router.replace('/(tabs)/feed')
    },
    [editing],
  )

  const handleError = useCallback(
    (reason: PublishError) => {
      /* Tableau exhaustif : le compilateur signale tout nouveau motif
         de publication sans message dédié. */
      const message: Record<PublishError, string> = {
        auth: t.news.compose.errorForbidden,
        write: t.news.compose.errorPublish,
        upload: t.news.compose.errorPublish,
        rateLimit: t.news.compose.errorRateLimit,
      }
      Alert.alert(t.news.compose.errorTitle, message[reason])
    },
    [t],
  )

  const { publish, publishing, progress } = useComposePublish({
    postId: editPostId,
    onSuccess: handleSuccess,
    onError: handleError,
  })

  const {
    pending: pendingDraft,
    consumePending,
    discardPending,
    saveNow,
  } = useComposeDraft({
    state,
    snapshot,
    // Éditer un post existant ne doit pas écraser un brouillon en cours.
    enabled: !editing && !publishing,
    hasContent,
  })

  /** Contenu non enregistré : diffère de la baseline, hors chargement/envoi. */
  const isDirty = !publishing && !loadingPost && snapshot !== baseline

  /* Une publication partagée depuis une autre app arrive par l'URL. Elle
     apporte du texte, pas un média : le mode texte est le bon point d'entrée. */
  useEffect(() => {
    if (!sharedUrl || editPostId) return
    setText(sharedUrl)
    setMode('text')
  }, [sharedUrl, editPostId, setText])

  useEffect(() => {
    if (!editPostId || !user) return

    let cancelled = false

    loadPost(editPostId)
      .then((post) => {
        if (cancelled) return
        if (!post) {
          // Introuvable ou échec réseau : on ne laisse pas un éditeur vide.
          Alert.alert(t.news.compose.errorTitle, t.news.compose.errorLoad)
          router.back()
          return
        }

        if (post.userId !== user.uid) {
          Alert.alert(t.news.compose.errorTitle, t.news.compose.errorForbidden)
          router.back()
          return
        }

        const loaded = postToComposeState(post)
        dispatch({ type: 'hydrate', state: loaded })
        // La baseline reflète le contenu chargé : rien n'est « sale » à l'ouverture.
        setBaseline(composeSnapshot(loaded))
      })
      .finally(() => {
        if (!cancelled) setLoadingPost(false)
      })

    return () => {
      cancelled = true
    }
  }, [editPostId, user, dispatch, t])

  /** Vignette best-effort : sans elle, <Image> ne sait pas rendre une vidéo. */
  const attachThumbnail = useCallback(
    async (uri: string) => {
      try {
        const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, {
          time: 1000,
          quality: 0.6,
        })
        dispatch({ type: 'setMediaThumbnail', uri, thumbnailUri: thumbnail.uri })
      } catch (error) {
        captureException(
          error instanceof Error ? error : new Error(String(error)),
          { context: 'news.compose.thumbnail' },
        )
      }
    },
    [dispatch],
  )

  const addMedia = useCallback(
    (media: SelectedMedia[]) => {
      dispatch({ type: 'addMedia', media })
      media
        .filter((item) => item.type === 'video')
        .forEach((item) => attachThumbnail(item.uri))
    },
    [dispatch, attachThumbnail],
  )

  /* La grille pilote la sélection depuis `state.media` : la règle « une
     vidéo occupe la publication entière » et le plafond de médias vivent
     dans le reducer, pas ici. */
  const handleToggleAsset = useCallback(
    (asset: GalleryAsset) => {
      lightImpact()

      const already = state.media.some((item) => item.uri === asset.uri)
      if (already) {
        dispatch({ type: 'removeMedia', uri: asset.uri })
        return
      }

      const isVideo = asset.mediaType === 'video'
      if (!isVideo && state.media.length >= COMPOSE_MAX_MEDIA) return

      addMedia([
        {
          uri: asset.uri,
          type: isVideo ? 'video' : 'image',
          width: asset.width,
          height: asset.height,
          duration: asset.duration ?? null,
        },
      ])
    },
    [state.media, dispatch, addMedia, lightImpact],
  )

  const handleCapture = useCallback(
    (media: SelectedMedia) => {
      addMedia([media])
      setStep('details')
    },
    [addMedia],
  )

  /* « Ajouter » depuis l'étape détails : on ne revient pas à la grille, ce
     qui perdrait la légende déjà saisie. Le sélecteur système suffit. */
  const pickMoreMedia = useCallback(async () => {
    lightImpact()

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: COMPOSE_MAX_MEDIA,
      quality: 0.9,
    })

    if (result.canceled) return

    addMedia(
      result.assets.map((asset) => ({
        uri: asset.uri,
        type: 'image' as const,
        width: asset.width,
        height: asset.height,
      })),
    )
  }, [addMedia, lightImpact])

  const pickArticleCover = useCallback(async () => {
    lightImpact()

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.9,
    })

    if (result.canceled) return
    dispatch({ type: 'setArticleCover', coverImage: result.assets[0].uri })
  }, [dispatch, lightImpact])

  const detectLocation = useCallback(async () => {
    setDetectingLocation(true)

    try {
      const { status } = await Location.requestForegroundPermissionsAsync()

      if (status !== 'granted') {
        Alert.alert(t.news.compose.errorTitle, t.news.compose.errorLocationDenied)
        return
      }

      const position = await Location.getCurrentPositionAsync({})
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      })

      const parts = [place?.city || place?.district, place?.country].filter(Boolean)

      dispatch({
        type: 'setLocation',
        location: {
          name: parts.join(', ') || t.news.compose.locationCurrent,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
      })
    } catch (error) {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        { context: 'news.compose.location' },
      )
      Alert.alert(t.news.compose.errorTitle, t.news.compose.errorLocation)
    } finally {
      setDetectingLocation(false)
    }
  }, [dispatch, t])

  /* Changer d'onglet fait jouer l'exclusion mutuelle du reducer : ouvrir un
     sondage vide les médias, ajouter un média ferme le sondage. On la
     déclenche ici pour que l'onglet reflète toujours l'état réel. */
  const handleChangeMode = useCallback(
    (next: ComposeMode) => {
      lightImpact()
      setMode(next)
      setStep('pick')

      if (next === 'poll') {
        dispatch({ type: 'openPoll' })
        return
      }
      if (state.poll) dispatch({ type: 'closePoll' })
    },
    [dispatch, lightImpact, state.poll],
  )

  const handleToggleArticle = useCallback(() => {
    lightImpact()
    dispatch({ type: state.article ? 'closeArticle' : 'openArticle' })
  }, [dispatch, lightImpact, state.article])

  const handleSelectSharedVideo = useCallback(
    (video: VideoType) => {
      lightImpact()
      dispatch({
        type: 'setSharedVideo',
        video: {
          sharedVideoId: video.id,
          sharedVideoURL: video.videoURL,
          sharedThumbnailURL: video.thumbnailURL,
          sharedUserName: video.userName,
          originalDescription: video.description,
        },
      })
      setVideoPickerOpen(false)
      setStep('details')
    },
    [dispatch, lightImpact],
  )

  const handleResumeDraft = useCallback(() => {
    const draft = consumePending()
    if (draft) {
      dispatch({ type: 'hydrate', state: draft })
      setStep('details')
    }
  }, [consumePending, dispatch])

  const requestClose = useCallback(() => {
    if (!isDirty) {
      router.back()
      return
    }

    /* En création, le contenu peut être gardé ; en édition il n'y a pas de
       brouillon possible, donc la seule question est d'abandonner ou non. */
    if (editing) {
      Alert.alert(t.news.compose.discardTitle, t.news.compose.discardMsg, [
        { text: t.news.compose.discardKeep, style: 'cancel' },
        {
          text: t.news.compose.discardConfirm,
          style: 'destructive',
          onPress: () => router.back(),
        },
      ])
      return
    }

    Alert.alert(t.news.compose.draftSaveTitle, t.news.compose.draftSaveMsg, [
      { text: t.news.compose.discardKeep, style: 'cancel' },
      {
        text: t.news.compose.draftDiscard,
        style: 'destructive',
        onPress: () => {
          clearComposeDraft()
          router.back()
        },
      },
      {
        text: t.news.compose.save,
        onPress: async () => {
          await saveNow()
          router.back()
        },
      },
    ])
  }, [editing, isDirty, saveNow, t])

  /* Revenir de la finalisation rend la main à la grille sans rien effacer :
     la sélection reste, l'utilisateur peut l'ajuster puis repartir. */
  const handleBack = useCallback(() => {
    if (step === 'details' && !editing) {
      setStep('pick')
      return
    }
    requestClose()
  }, [step, editing, requestClose])

  const handlePublish = useCallback(() => {
    if (!user) {
      handleError('auth')
      return
    }

    publish(state, {
      uid: user.uid,
      displayName:
        user.displayName || user.email?.split('@')[0] || t.news.compose.userFallback,
    })
  }, [handleError, publish, state, user, t])

  if (loadingPost) {
    return (
      <PageWrapper type="stack" swipeBack backTo="/(tabs)/feed">
        <SafeAreaView style={styles.loading}>
          <OrbitLoader size={72} />
        </SafeAreaView>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper type="stack" swipeBack backTo="/(tabs)/feed">
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ComposeHeader
            editing={editing}
            canPublish={inDetails ? canPublish : state.media.length > 0}
            publishing={publishing}
            title={step === 'details' && !editing ? t.news.compose.detailsTitle : undefined}
            actionLabel={inDetails ? undefined : t.news.compose.next}
            leading={step === 'details' && !editing ? 'back' : 'close'}
            onClose={handleBack}
            onPublish={inDetails ? handlePublish : () => setStep('details')}
          />

          {pendingDraft ? (
            <DraftBanner
              preview={draftPreview(pendingDraft)}
              onResume={handleResumeDraft}
              onDiscard={discardPending}
            />
          ) : null}

          {!editing && step === 'pick' ? (
            <ComposeModeTabs mode={mode} onChange={handleChangeMode} />
          ) : null}

          <View style={styles.flex}>
            {inDetails ? (
              <ComposeDetails
                userName={user?.displayName || user?.email?.split('@')[0] || ''}
                photoURL={photoURL}
                text={state.text}
                media={state.media}
                visibility={state.visibility}
                background={state.background}
                location={state.location}
                mood={state.mood}
                poll={state.poll}
                article={state.article}
                sharedVideo={state.sharedVideo}
                canUseBackground={canUseBackground}
                detectingLocation={detectingLocation}
                showArticleToggle={mode === 'text'}
                onChangeText={setText}
                onPressVisibility={() => setVisibilityOpen(true)}
                onPressLocation={detectLocation}
                onPressMood={() => setMoodOpen(true)}
                onRemoveLocation={() => dispatch({ type: 'setLocation', location: null })}
                onChangeBackground={(background) => dispatch({ type: 'setBackground', background })}
                onRemoveMedia={(uri) => dispatch({ type: 'removeMedia', uri })}
                onAddMoreMedia={pickMoreMedia}
                onToggleArticle={handleToggleArticle}
                onChangeArticleTitle={(title) => dispatch({ type: 'setArticleTitle', title })}
                onChangeArticleBody={(body) => dispatch({ type: 'setArticleBody', body })}
                onPickArticleCover={pickArticleCover}
                onRemoveArticleCover={() => dispatch({ type: 'setArticleCover', coverImage: null })}
                onChangePollQuestion={(question) => dispatch({ type: 'setPollQuestion', question })}
                onChangePollOption={(id, text) => dispatch({ type: 'setPollOption', id, text })}
                onAddPollOption={() => dispatch({ type: 'addPollOption' })}
                onRemovePollOption={(id) => dispatch({ type: 'removePollOption', id })}
                onRemovePoll={() => handleChangeMode('gallery')}
                onChangeSharedVideo={() => setVideoPickerOpen(true)}
                onRemoveSharedVideo={() => dispatch({ type: 'setSharedVideo', video: null })}
              />
            ) : mode === 'camera' ? (
              <ComposeCamera onCapture={handleCapture} />
            ) : (
              <GalleryGrid
                selectedUris={state.media.map((item) => item.uri)}
                onToggle={handleToggleAsset}
                onPickMboloVideo={() => setVideoPickerOpen(true)}
              />
            )}
          </View>
        </KeyboardAvoidingView>

        <VisibilitySheet
          visible={visibilityOpen}
          value={state.visibility}
          onChange={(visibility) => dispatch({ type: 'setVisibility', visibility })}
          onClose={() => setVisibilityOpen(false)}
        />

        <MoodSheet
          visible={moodOpen}
          value={state.mood}
          onChange={(mood) => dispatch({ type: 'setMood', mood })}
          onClose={() => setMoodOpen(false)}
        />

        {videoPickerOpen && user ? (
          <VideoPickerModal
            visible
            userId={user.uid}
            onClose={() => setVideoPickerOpen(false)}
            onSelect={handleSelectSharedVideo}
          />
        ) : null}

        {publishing ? <PublishProgress progress={progress} /> : null}
      </SafeAreaView>
    </PageWrapper>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: postColors.canvas },
  flex: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.canvas,
  },
})
