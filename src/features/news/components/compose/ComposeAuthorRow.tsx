/* src/features/news/components/compose/ComposeAuthorRow.tsx
   Avatar + nom + pastille d'audience. La pastille ouvre la feuille de
   visibilité : Facebook place ce réglage sous le nom parce que c'est là
   que le regard cherche « qui va voir ça ». */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { getAvatarImageUrl } from '@/lib/cloudinary'
import { useI18n } from '@/i18n'
import { postColors, postMotion, postRadius, postSpacing, postType } from '../../theme/postTokens'
import type { NewsPostVisibility } from '../../types'

type IoniconName = keyof typeof Ionicons.glyphMap

export const VISIBILITY_ICON: Record<NewsPostVisibility, IoniconName> = {
  public: 'earth',
  followers: 'people',
  private: 'lock-closed',
}

interface ComposeAuthorRowProps {
  userName: string
  photoURL?: string | null
  visibility: NewsPostVisibility
  moodLabel: string | null
  locationName: string | null
  onPressVisibility: () => void
}

function ComposeAuthorRowBase({
  userName,
  photoURL,
  visibility,
  moodLabel,
  locationName,
  onPressVisibility,
}: ComposeAuthorRowProps) {
  const { t } = useI18n()

  const audience = {
    public: t.news.compose.audiencePublic,
    followers: t.news.compose.audienceFollowers,
    private: t.news.compose.audiencePrivate,
  }[visibility]

  /* Prévisualise la ligne d'activité telle qu'elle apparaîtra dans le fil. */
  const activity = [
    moodLabel ? `${t.news.activityFeeling} ${moodLabel}` : null,
    locationName ? `${t.news.activityAt} ${locationName}` : null,
  ]
    .filter(Boolean)
    .join(' ')

  const avatarUrl = getAvatarImageUrl(photoURL ?? undefined)

  return (
    <View style={styles.row}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarEmpty]}>
          <Ionicons name="person" size={20} color={postColors.textTertiary} />
        </View>
      )}

      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>
          {userName}
          {activity ? <Text style={styles.activity}>{` ${activity}`}</Text> : null}
        </Text>

        <Pressable
          onPress={onPressVisibility}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.a11yAudience}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Ionicons name={VISIBILITY_ICON[visibility]} size={12} color={postColors.textSecondary} />
          <Text style={styles.chipText}>{audience}</Text>
          <Ionicons name="chevron-down" size={12} color={postColors.textSecondary} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.rowGap,
    paddingHorizontal: postSpacing.gutter,
    paddingTop: postSpacing.headerTop,
  },
  avatar: {
    width: postRadius.avatar * 2,
    height: postRadius.avatar * 2,
    borderRadius: postRadius.avatar,
    backgroundColor: postColors.surfaceRaised,
  },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, gap: postSpacing.inlineGap },
  name: { color: postColors.textPrimary, ...postType.author },
  activity: { color: postColors.textSecondary, ...postType.authorSuffix },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: postRadius.chip,
    backgroundColor: postColors.chipSurface,
  },
  chipText: { color: postColors.textSecondary, ...postType.meta },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const ComposeAuthorRow = memo(ComposeAuthorRowBase)
