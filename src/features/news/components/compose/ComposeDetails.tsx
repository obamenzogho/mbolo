/* src/features/news/components/compose/ComposeDetails.tsx

   Étape de finalisation, commune à tous les modes.

   Le média (ou le sondage) est déjà choisi : il ne reste qu'à l'habiller —
   légende, audience, lieu, humeur. Regrouper ces blocs ici garde
   l'orchestrateur lisible : il décide du mode et de l'étape, pas de
   l'agencement des champs.

   Les deux boutons « Lieu » et « Humeur » ouvrent respectivement une
   géolocalisation et une feuille. Ils vivent sous la saisie plutôt que dans
   une feuille d'options : ce sont les deux seuls ajouts facultatifs
   restants, une feuille pour deux entrées serait un détour inutile. */

import { memo } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { postColors, postMotion, postRadius, postSpacing, postType } from '../../theme/postTokens'
import type { SelectedMedia } from '../../hooks/useComposeState'
import type {
  NewsLocation,
  NewsMood,
  NewsPoll,
  NewsPostVideoShare,
  NewsPostVisibility,
  PostBackgroundId,
} from '../../types'
import { ArticleEditor } from './ArticleEditor'
import { BackgroundPicker } from './BackgroundPicker'
import { ComposeAuthorRow } from './ComposeAuthorRow'
import { ComposeInput } from './ComposeInput'
import { LocationChip } from './LocationChip'
import { MediaTray } from './MediaTray'
import { PollEditor } from './PollEditor'
import { VideoSharePreview } from './VideoSharePreview'

interface ComposeDetailsProps {
  userName: string
  photoURL: string | null

  text: string
  media: SelectedMedia[]
  visibility: NewsPostVisibility
  background: PostBackgroundId
  location: NewsLocation | null
  mood: NewsMood | null
  poll: NewsPoll | null
  article: { title: string; body: string; coverImage: string | null } | null
  sharedVideo: NewsPostVideoShare | null

  /** Le fond coloré n'a de sens que sur un texte seul. */
  canUseBackground: boolean
  detectingLocation: boolean
  /** Vrai dans le mode Texte : l'article s'y active à la demande. */
  showArticleToggle: boolean

  onChangeText: (text: string) => void
  onPressVisibility: () => void
  onPressLocation: () => void
  onPressMood: () => void
  onRemoveLocation: () => void
  onChangeBackground: (id: PostBackgroundId) => void
  onRemoveMedia: (uri: string) => void
  onAddMoreMedia: () => void
  onToggleArticle: () => void
  onChangeArticleTitle: (title: string) => void
  onChangeArticleBody: (body: string) => void
  onPickArticleCover: () => void
  onRemoveArticleCover: () => void
  onChangePollQuestion: (question: string) => void
  onChangePollOption: (id: string, text: string) => void
  onAddPollOption: () => void
  onRemovePollOption: (id: string) => void
  onRemovePoll: () => void
  onChangeSharedVideo: () => void
  onRemoveSharedVideo: () => void
}

function ComposeDetailsBase({
  userName,
  photoURL,
  text,
  media,
  visibility,
  background,
  location,
  mood,
  poll,
  article,
  sharedVideo,
  canUseBackground,
  detectingLocation,
  showArticleToggle,
  onChangeText,
  onPressVisibility,
  onPressLocation,
  onPressMood,
  onRemoveLocation,
  onChangeBackground,
  onRemoveMedia,
  onAddMoreMedia,
  onToggleArticle,
  onChangeArticleTitle,
  onChangeArticleBody,
  onPickArticleCover,
  onRemoveArticleCover,
  onChangePollQuestion,
  onChangePollOption,
  onAddPollOption,
  onRemovePollOption,
  onRemovePoll,
  onChangeSharedVideo,
  onRemoveSharedVideo,
}: ComposeDetailsProps) {
  const { t } = useI18n()

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ComposeAuthorRow
        userName={userName}
        photoURL={photoURL}
        visibility={visibility}
        moodLabel={mood ? `${mood.emoji} ${mood.label}` : null}
        locationName={location?.name ?? null}
        onPressVisibility={onPressVisibility}
      />

      <ComposeInput
        value={text}
        background={background}
        articleMode={Boolean(article)}
        onChangeText={onChangeText}
      />

      <LocationChip
        location={location}
        detecting={detectingLocation}
        onRemove={onRemoveLocation}
      />

      <MediaTray media={media} onRemove={onRemoveMedia} onAddMore={onAddMoreMedia} />

      {sharedVideo ? (
        <VideoSharePreview
          video={sharedVideo}
          onChange={onChangeSharedVideo}
          onRemove={onRemoveSharedVideo}
        />
      ) : null}

      {poll ? (
        <PollEditor
          poll={poll}
          onChangeQuestion={onChangePollQuestion}
          onChangeOption={onChangePollOption}
          onAddOption={onAddPollOption}
          onRemoveOption={onRemovePollOption}
          onRemove={onRemovePoll}
        />
      ) : null}

      {article ? (
        <ArticleEditor
          title={article.title}
          body={article.body}
          coverImage={article.coverImage}
          onChangeTitle={onChangeArticleTitle}
          onChangeBody={onChangeArticleBody}
          onPickCover={onPickArticleCover}
          onRemoveCover={onRemoveArticleCover}
          onRemove={onToggleArticle}
        />
      ) : null}

      {canUseBackground ? (
        <BackgroundPicker value={background} onChange={onChangeBackground} />
      ) : null}

      <View style={styles.actions}>
        {showArticleToggle && !article ? (
          <Pressable
            onPress={onToggleArticle}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Ionicons name="document-text" size={18} color={postColors.optionArticle} />
            <Text style={styles.actionText}>{t.news.compose.articleToggle}</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onPressLocation}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons name="location" size={18} color={postColors.optionLocation} />
          <Text style={styles.actionText}>{t.news.compose.optionLocation}</Text>
        </Pressable>

        <Pressable
          onPress={onPressMood}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons name="happy" size={18} color={postColors.optionMood} />
          <Text style={styles.actionText}>{t.news.compose.optionMood}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  actions: {
    marginTop: postSpacing.rowGap,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: postColors.hairline,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.gutter,
    paddingVertical: 13,
    paddingHorizontal: postSpacing.gutter,
  },
  actionText: { color: postColors.textPrimary, ...postType.composeOption },
  pressed: { opacity: postMotion.pressedOpacity, borderRadius: postRadius.input },
})

export const ComposeDetails = memo(ComposeDetailsBase)
