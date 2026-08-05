/* CaptionScreen.tsx — Étape de légende, niveau Instagram.

   Layout (de haut en bas) :
   1. ComposeAuthorRow (avatar + nom + chip audience)
   2. Éditeur : thumbnail 72×72 + TextInput multiline
   3. Compteur de caractères (apparaît au-delà de 80%)
   4. Chips de suggestions (hashtags / mentions)
   5. Carrousel des médias (si >1)
   6. Lignes de réglages (lieu, commentaires, texte alternatif) */

import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import type { NewsLocation, NewsPostVisibility } from '@/features/news/types'
import { ComposeAuthorRow } from '@/features/news/components/compose/ComposeAuthorRow'
import RichPostText from '@/features/news/components/RichPostText'
import { colors } from '@/lib/theme'
import { createColors, createType } from '../theme/createTokens'
import { useCaptionSuggestions } from '../hooks/useCaptionSuggestions'
import type { HashtagResult, UserResult } from '@/services/searchService'

const THUMB_SIZE = 56
const THUMB_GAP = 4
const CHAR_LIMIT = 1000
const CHAR_WARN_RATIO = 0.8
/* Un # ou @ active le mode riche : l'input devient transparent et un
   overlay texte fantôme (RichPostText) colore hashtags/mentions en vert. */
const HAS_RICH_TOKEN = /[#@]/

interface CaptionScreenProps {
  media: SelectedMedia[]
  text: string
  onChangeText: (text: string) => void
  visibility: NewsPostVisibility
  onPressVisibility: () => void
  commentsEnabled: boolean
  onToggleComments: () => void
  location: NewsLocation | null
  detectingLocation: boolean
  onPressLocation: () => void
  soundId?: string
  onPressSound?: () => void
  /* Auteur (nom + photo depuis Firestore, pas juste Auth). */
  userName: string
  userPhotoURL: string | null
  /* Texte alternatif par média. */
  onAltTextChange: (index: number, altText: string) => void
}

const VISIBILITY_ICON: Record<NewsPostVisibility, keyof typeof Ionicons.glyphMap> = {
  public: 'globe-outline',
  followers: 'people-outline',
  private: 'lock-closed-outline',
}

function CaptionScreenComponent({
  media,
  text,
  onChangeText,
  visibility,
  onPressVisibility,
  commentsEnabled,
  onToggleComments,
  location,
  detectingLocation,
  onPressLocation,
  soundId,
  onPressSound,
  userName,
  userPhotoURL,
  onAltTextChange,
}: CaptionScreenProps) {
  const { t } = useI18n()
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [editingAltIndex, setEditingAltIndex] = useState<number | null>(null)
  const [altInput, setAltInput] = useState('')
  const inputRef = useRef<TextInput>(null)
  const [cursorPos, setCursorPos] = useState(0)
  /* Curseur piloté après insertion chip : positionne le caret à la fin
     du texte inséré, puis se libère au premier onSelectionChange. */
  const [inputSelection, setInputSelection] = useState<{ start: number; end: number } | undefined>()

  const focused = media[focusedIndex] ?? null

  /* ── Suggestions hashtags / mentions ───────────────────────────── */
  const suggestions = useCaptionSuggestions()

  const handleTextChange = useCallback((newText: string) => {
    onChangeText(newText)
    /* newText.length (et non cursorPos) : onSelectionChange arrive APRÈS
       onChangeText, donc cursorPos est toujours décalé d'un cran. */
    suggestions.detect(newText, newText.length)
  }, [onChangeText, suggestions])

  const handleSelectionChange = useCallback((e: { nativeEvent: { selection: { start: number; end: number } } }) => {
    /* Libérer le contrôle du curseur dès que l'utilisateur bouge la sélection. */
    setInputSelection(undefined)
    setCursorPos(e.nativeEvent.selection.end)
  }, [])

  const handleInsertHashtag = useCallback((tag: string) => {
    const updated = suggestions.insertHashtag(tag, text)
    onChangeText(updated)
    suggestions.reset()
    /* Placer le curseur à la fin du texte inséré. */
    setInputSelection({ start: updated.length, end: updated.length })
  }, [suggestions, text, onChangeText])

  const handleInsertMention = useCallback((pseudo: string) => {
    const updated = suggestions.insertMention(pseudo, text)
    onChangeText(updated)
    suggestions.reset()
    /* Placer le curseur à la fin du texte inséré. */
    setInputSelection({ start: updated.length, end: updated.length })
  }, [suggestions, text, onChangeText])

  /* ── Compteur de caractères ────────────────────────────────────── */
  const charCount = text.length
  const charRatio = charCount / CHAR_LIMIT
  const showCounter = charCount > 0
  const counterColor = charRatio > 1
    ? createColors.danger
    : charRatio > CHAR_WARN_RATIO
      ? '#E6A817'
      : createColors.textSecondary

  /* ── Alt text ─────────────────────────────────────────────────── */
  const handleThumbPress = useCallback((idx: number) => {
    if (editingAltIndex !== null) {
      onAltTextChange(editingAltIndex, altInput.trim())
      setEditingAltIndex(null)
    }
    setFocusedIndex(idx)
  }, [editingAltIndex, altInput, onAltTextChange])

  const startEditAlt = useCallback(() => {
    if (!focused) return
    setEditingAltIndex(focusedIndex)
    setAltInput(focused.altText ?? '')
  }, [focused, focusedIndex])

  const saveAlt = useCallback(() => {
    if (editingAltIndex !== null) {
      onAltTextChange(editingAltIndex, altInput.trim())
    }
    setEditingAltIndex(null)
    setAltInput('')
  }, [editingAltIndex, altInput, onAltTextChange])

  /* ── Mode riche : overlay texte fantôme (hashtags/mentions colorés). ── */
  const hasRichTokens = HAS_RICH_TOKEN.test(text)
  /* Espace trailing pour aligner la position du caret avec le fantôme. */
  const ghostValue = hasRichTokens && !text.endsWith('\n') ? `${text} ` : text

  return (
    <View style={styles.screen}>
      {/* ── Auteur + audience ───────────────────────────────────── */}
      <ComposeAuthorRow
        userName={userName}
        photoURL={userPhotoURL}
        visibility={visibility}
        moodLabel={null}
        locationName={location?.name ?? null}
        onPressVisibility={onPressVisibility}
      />

      {/* ── Éditeur : thumbnail + texte ─────────────────────────── */}
      <View style={styles.editorRow}>
        <View style={styles.preview}>
          {focused ? (
            <Image
              source={{ uri: focused.thumbnailUri ?? focused.uri }}
              style={styles.previewMedia}
              contentFit="cover"
            />
          ) : null}
        </View>
        <View style={styles.editorField}>
          {hasRichTokens ? (
            <View
              style={styles.captionGhostLayer}
              pointerEvents="none"
              testID="captionGhostLayer"
            >
              <RichPostText
                text={ghostValue}
                style={styles.captionGhost}
                /* Sans fontWeight : les tokens doivent garder les métriques
                   exactes du TextInput transparent (même largeur de glyphe),
                   sinon le caret se pose sur la lettre. La couleur seule
                   distingue les hashtags/mentions, comme dans Instagram. */
                linkStyle={styles.captionGhostLink}
              />
            </View>
          ) : null}
          <TextInput
            ref={inputRef as React.RefObject<TextInput>}
            style={[styles.caption, createType.caption, hasRichTokens && styles.captionRich]}
            multiline
            value={text}
            selection={inputSelection}
            onChangeText={handleTextChange}
            onSelectionChange={handleSelectionChange}
            placeholder={t.news.compose.captionHint}
            placeholderTextColor={createColors.textSecondary}
            cursorColor={createColors.textPrimary}
            selectionColor={createColors.textPrimary}
            maxLength={CHAR_LIMIT + 100}
          />
        </View>
      </View>

      {/* ── Compteur de caractères ───────────────────────────────── */}
      {showCounter ? (
        <View style={styles.counterRow}>
          <Text style={[styles.counter, { color: counterColor }]}>
            {charCount}/{CHAR_LIMIT}
          </Text>
        </View>
      ) : null}

      {/* ── Chips de suggestions ─────────────────────────────────── */}
      {suggestions.kind === 'hashtag' ? (
        <View style={styles.suggestionList}>
          {suggestions.loading ? (
            <View style={styles.suggestionLoading}>
              <Text style={styles.suggestionLoadingText}>…</Text>
            </View>
          ) : suggestions.hashtags.length > 0 ? suggestions.hashtags.map((h: HashtagResult) => (
            <Pressable
              key={h.tag}
              onPress={() => handleInsertHashtag(h.tag)}
              accessibilityRole="button"
              accessibilityLabel={t.news.compose.a11ySuggestionHashtag.replace('{tag}', h.tag)}
              style={styles.suggestionItem}
            >
              <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
              <Text style={styles.suggestionItemHashtag}>#{h.tag}</Text>
            </Pressable>
          )) : null}
        </View>
      ) : null}

      {suggestions.kind === 'mention' ? (
        <View style={styles.suggestionList}>
          {suggestions.loading ? (
            <View style={styles.suggestionLoading}>
              <Text style={styles.suggestionLoadingText}>…</Text>
            </View>
          ) : suggestions.users.length > 0 ? suggestions.users.map((u: UserResult) => (
            <Pressable
              key={u.id}
              onPress={() => handleInsertMention(u.pseudo)}
              accessibilityRole="button"
              accessibilityLabel={t.news.compose.a11ySuggestionMention.replace('{name}', u.pseudo)}
              style={styles.suggestionItem}
            >
              {u.photoURL ? (
                <Image source={{ uri: u.photoURL }} style={styles.suggestionAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.suggestionAvatar, styles.suggestionAvatarEmpty]}>
                  <Ionicons name="person" size={12} color={createColors.textSecondary} />
                </View>
              )}
              <Text style={styles.suggestionItemText}>@{u.pseudo}</Text>
            </Pressable>
          )) : null}
        </View>
      ) : null}

      {/* ── Carrousel des médias (si >1) ────────────────────────── */}
      {media.length > 1 ? (
        <View style={styles.carouselWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
          >
            {media.map((m, idx) => (
              <Pressable
                key={m.uri}
                onPress={() => handleThumbPress(idx)}
                accessibilityRole="button"
                accessibilityState={{ selected: idx === focusedIndex }}
                style={[
                  styles.thumb,
                  idx === focusedIndex && styles.thumbFocused,
                ]}
              >
                <Image
                  source={{ uri: m.thumbnailUri ?? m.uri }}
                  style={styles.thumbImage}
                  contentFit="cover"
                />
                {m.type === 'video' ? (
                  <View style={styles.videoBadge}>
                    <Ionicons name="play" size={10} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ── Texte alternatif (inline) ───────────────────────────── */}
      {editingAltIndex !== null ? (
        <View style={styles.altRow}>
          <Ionicons name="accessibility-outline" size={20} color={createColors.textPrimary} />
          <TextInput
            style={[styles.altInput, createType.caption]}
            value={altInput}
            onChangeText={setAltInput}
            placeholder={t.news.compose.altTextHint}
            placeholderTextColor={createColors.textSecondary}
            autoFocus
            maxLength={250}
          />
          <Pressable onPress={saveAlt} accessibilityRole="button" style={styles.altDone}>
            <Text style={styles.altDoneText}>{t.news.compose.altTextDone}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={startEditAlt}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.a11yAltText}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Ionicons name="accessibility-outline" size={22} color={createColors.textPrimary} />
          <Text style={[styles.rowLabel, createType.row]}>
            {focused?.altText
              ? t.news.compose.altText
              : t.news.compose.altTextHint}
          </Text>
          {focused?.altText ? (
            <Ionicons name="checkmark-circle" size={18} color={createColors.accent} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={createColors.textSecondary} />
          )}
        </Pressable>
      )}

      {media.some((item) => item.type === 'video') ? (
        <Pressable
          onPress={onPressSound}
          disabled={!onPressSound}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.a11ySoundPicker}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Ionicons name="musical-notes-outline" size={22} color={createColors.textPrimary} />
          <Text style={[styles.rowLabel, createType.row]}>
            {soundId
              ? t.news.compose.soundSelected
              : t.news.compose.soundSelect}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={createColors.textSecondary} />
        </Pressable>
      ) : null}

      {/* ── Lieu ────────────────────────────────────────────────── */}
      <Pressable
        onPress={onPressLocation}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons
          name={detectingLocation ? 'locate' : 'location-outline'}
          size={22}
          color={createColors.textPrimary}
        />
        <Text style={[styles.rowLabel, createType.row]}>
          {detectingLocation
            ? '…'
            : location?.name || t.news.compose.locationAdd}
        </Text>
        {location ? (
          <Ionicons name="close-circle" size={20} color={createColors.textSecondary} />
        ) : null}
      </Pressable>

      {/* ── Commentaires ────────────────────────────────────────── */}
      <Pressable
        onPress={onToggleComments}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons name="chatbubble-outline" size={22} color={createColors.textPrimary} />
        <Text style={[styles.rowLabel, createType.row]}>
          {t.news.compose.commentsEnabled}
        </Text>
        <Ionicons
          name={commentsEnabled ? 'toggle' : 'toggle-outline'}
          size={28}
          color={createColors.textPrimary}
        />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: createColors.canvas },

  /* Éditeur */
  editorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: createColors.hairline,
  },
  preview: {
    width: 72,
    height: 72,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: createColors.surface,
  },
  previewMedia: { width: '100%', height: '100%' },
  caption: {
    flex: 1,
    color: createColors.textPrimary,
    minHeight: 72,
    paddingTop: 2,
  },
  editorField: {
    position: 'relative',
    flex: 1,
  },
  captionGhostLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  captionGhost: {
    color: createColors.textPrimary,
    paddingTop: 2,
  },
  /* Tokens du ghost : même poids que le texte de l'input (pas de gras) pour
     que le layout du caret corresponde exactement au texte visible. */
  captionGhostLink: {
    color: colors.primary,
    fontWeight: '400',
  },
  captionRich: {
    color: 'transparent',
  },

  /* Compteur */
  counterRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  counter: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },

  /* Suggestions — liste verticale style Instagram */
  suggestionList: {
    maxHeight: 240,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: createColors.hairline,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  suggestionAvatarEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: createColors.surface,
  },
  suggestionLoading: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  suggestionLoadingText: {
    fontSize: 15,
    color: createColors.textSecondary,
  },
  suggestionItemText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  suggestionItemHashtag: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },

  /* Carrousel */
  carouselWrap: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: createColors.hairline,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: THUMB_GAP,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbFocused: {
    borderColor: createColors.accent,
  },
  thumbImage: { width: '100%', height: '100%' },
  videoBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },

  /* Alt text */
  altRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: createColors.hairline,
  },
  altInput: {
    flex: 1,
    color: createColors.textPrimary,
    minHeight: 36,
  },
  altDone: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: createColors.accent,
  },
  altDoneText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Lignes */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: createColors.hairline,
  },
  pressed: { opacity: 0.6 },
  rowLabel: { flex: 1, color: createColors.textPrimary },
})

export const CaptionScreen = memo(CaptionScreenComponent)
