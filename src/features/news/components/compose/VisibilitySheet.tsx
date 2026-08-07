/* src/features/news/components/compose/VisibilitySheet.tsx
   Choix de l'audience. Chaque entrée porte une description : « Mes abonnés »
   seul n'indique pas ce qui arrive aux personnes qui ne suivent pas. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import BottomSheet from '@/components/ui/BottomSheet'
import { useI18n } from '@/i18n'
import { postColors, postMotion, postRadius, postSpacing, postType } from '../../theme/postTokens'
import type { NewsPostVisibility } from '../../types'
import { VISIBILITY_ICON } from './ComposeAuthorRow'

interface VisibilitySheetProps {
  visible: boolean
  value: NewsPostVisibility
  onChange: (visibility: NewsPostVisibility) => void
  onClose: () => void
}

function VisibilitySheetBase({ visible, value, onChange, onClose }: VisibilitySheetProps) {
  const { t } = useI18n()

  /* Audience de la publication (style Instagram) : « Tout le monde » ou
     « Amis proches ». Le compte privé se règle dans les paramètres, pas à
     la création. */
  const entries: { id: NewsPostVisibility; label: string; description: string }[] = [
    {
      id: 'public',
      label: t.news.compose.audiencePublic,
      description: t.news.compose.audiencePublicDesc,
    },
    {
      id: 'followers',
      label: t.news.compose.audienceFollowers,
      description: t.news.compose.audienceFollowersDesc,
    },
  ]

  return (
    <BottomSheet visible={visible} onClose={onClose} height="auto">
      <View style={styles.sheet}>
        <Text style={styles.title}>{t.news.compose.audienceTitle}</Text>

        {entries.map((entry) => {
          const active = entry.id === value

          return (
            <Pressable
              key={entry.id}
              onPress={() => {
                onChange(entry.id)
                onClose()
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.icon}>
                <Ionicons
                  name={VISIBILITY_ICON[entry.id]}
                  size={19}
                  color={active ? postColors.accent : postColors.textSecondary}
                />
              </View>

              <View style={styles.texts}>
                <Text style={styles.label}>{entry.label}</Text>
                <Text style={styles.description}>{entry.description}</Text>
              </View>

              {active ? (
                <Ionicons name="checkmark-circle" size={20} color={postColors.accent} />
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: postSpacing.gutter, paddingBottom: 28 },
  title: {
    color: postColors.textPrimary,
    ...postType.composeSection,
    paddingVertical: postSpacing.rowGap,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.gutter,
    paddingVertical: 11,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: postRadius.input,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.chipSurface,
  },
  texts: { flex: 1, gap: 2 },
  label: { color: postColors.textPrimary, ...postType.composeOption },
  description: { color: postColors.textSecondary, ...postType.meta },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const VisibilitySheet = memo(VisibilitySheetBase)
