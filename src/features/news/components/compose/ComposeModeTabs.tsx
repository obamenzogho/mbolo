/* src/features/news/components/compose/ComposeModeTabs.tsx

   Barre de modes, en haut de l'écran de création.

   Le choix du type de publication se fait avant tout le reste, comme sur
   Instagram : on décide d'abord « je pioche dans ma galerie » ou « je me
   filme », puis on compose. Placer ce choix en haut plutôt qu'en bas le
   sort du flux d'édition — ce n'est pas une action sur le contenu, c'est
   le cadre dans lequel on va le produire.

   La barre disparaît à l'étape de finalisation : une fois le média retenu,
   changer de mode reviendrait à jeter le travail en cours. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { postColors, postMotion, postSpacing, postType } from '../../theme/postTokens'

type IoniconName = keyof typeof Ionicons.glyphMap

export type ComposeMode = 'gallery' | 'camera' | 'text' | 'poll'

interface ComposeModeTabsProps {
  mode: ComposeMode
  onChange: (mode: ComposeMode) => void
}

function ComposeModeTabsBase({ mode, onChange }: ComposeModeTabsProps) {
  const { t } = useI18n()

  const tabs: { id: ComposeMode; icon: IoniconName; label: string }[] = [
    { id: 'gallery', icon: 'images-outline', label: t.news.compose.modeGallery },
    { id: 'camera', icon: 'camera-outline', label: t.news.compose.modeCamera },
    { id: 'text', icon: 'text-outline', label: t.news.compose.modeText },
    { id: 'poll', icon: 'stats-chart-outline', label: t.news.compose.modePoll },
  ]

  return (
    <View
      style={styles.bar}
      accessibilityRole="tablist"
      accessibilityLabel={t.news.compose.a11yMode}
    >
      {tabs.map((tab) => {
        const active = tab.id === mode

        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={active ? postColors.textPrimary : postColors.textTertiary}
            />
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            <View style={[styles.indicator, active && styles.indicatorActive]} />
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: postColors.cameraBackdrop,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingTop: postSpacing.rowGap,
  },
  label: { color: postColors.textTertiary, ...postType.composeTab },
  labelActive: { color: postColors.textPrimary },
  /* Réservé en permanence : sans cela, l'apparition du trait décale la
     hauteur de la barre à chaque changement d'onglet. */
  indicator: {
    height: 2,
    alignSelf: 'stretch',
    marginTop: postSpacing.inlineGap,
    backgroundColor: 'transparent',
  },
  indicatorActive: { backgroundColor: postColors.tabIndicator },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const ComposeModeTabs = memo(ComposeModeTabsBase)
