/* src/features/create/components/CaptionScreen.tsx

   Étape 2 du nouveau flux, portée du prototype createPost-instagram :
   écran clair, aperçu à gauche, légende puis réglages (visibilité,
   commentaires, lieu). */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import type { NewsLocation, NewsPostVisibility } from '@/features/news/types'
import { captionColors, createType } from '../theme/createTokens'

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
}: CaptionScreenProps) {
  const { t } = useI18n()
  const selected = media[0]

  return (
    <View style={styles.screen}>
      <View style={styles.editorRow}>
        <View style={styles.preview}>
          {selected ? (
            <Image
              source={{ uri: selected.thumbnailUri ?? selected.uri }}
              style={styles.previewMedia}
              contentFit="cover"
            />
          ) : null}
        </View>
        <TextInput
          style={[styles.caption, createType.caption]}
          multiline
          value={text}
          onChangeText={onChangeText}
          placeholder={t.news.compose.placeholder}
          placeholderTextColor={captionColors.textSecondary}
          maxLength={1000}
        />
      </View>

      <Pressable
        onPress={onPressVisibility}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons name={VISIBILITY_ICON[visibility]} size={22} color={captionColors.textPrimary} />
        <Text style={[styles.rowLabel, createType.row]}>
          {visibility === 'public'
            ? t.news.compose.audiencePublic
            : visibility === 'followers'
              ? t.news.compose.audienceFollowers
              : t.news.compose.audiencePrivate}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={captionColors.textSecondary} />
      </Pressable>

      <Pressable
        onPress={onToggleComments}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons name="chatbubble-outline" size={22} color={captionColors.textPrimary} />
        <Text style={[styles.rowLabel, createType.row]}>
          {t.news.compose.commentsEnabled}
        </Text>
        <Ionicons
          name={commentsEnabled ? 'toggle' : 'toggle-outline'}
          size={28}
          color={captionColors.textPrimary}
        />
      </Pressable>

      <Pressable
        onPress={onPressLocation}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Ionicons
          name={detectingLocation ? 'locate' : 'location-outline'}
          size={22}
          color={captionColors.textPrimary}
        />
        <Text style={[styles.rowLabel, createType.row]}>
          {detectingLocation
            ? '…'
            : location?.name || t.news.compose.locationAdd}
        </Text>
        {location ? (
          <Ionicons name="close-circle" size={20} color={captionColors.textSecondary} />
        ) : null}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: captionColors.canvas },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: captionColors.hairline,
  },
  preview: {
    width: 72,
    height: 72,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#eeeeee',
  },
  previewMedia: { width: '100%', height: '100%' },
  caption: {
    flex: 1,
    color: captionColors.textPrimary,
    minHeight: 72,
    paddingTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: captionColors.hairline,
  },
  pressed: { opacity: 0.6 },
  rowLabel: { flex: 1, color: captionColors.textPrimary },
})

export const CaptionScreen = memo(CaptionScreenComponent)
