/* src/features/news/components/compose/ComposeInput.tsx

   Zone de saisie principale. Deux rendus pour un même champ :
   — texte simple sur fond sombre ;
   — texte héroïque centré sur dégradé quand un fond est choisi.

   Le compteur n'apparaît qu'aux abords de la limite : affiché en permanence,
   il transforme l'écriture en exercice de comptage. */

import { memo } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useI18n } from '@/i18n'
import { COMPOSE_LIMITS, postColors, postSpacing, postType } from '../../theme/postTokens'
import { POST_BACKGROUNDS, type PostBackgroundId } from '../../types'

interface ComposeInputProps {
  value: string
  background: PostBackgroundId
  /** L'article a son propre corps : la saisie devient l'accroche du fil. */
  articleMode: boolean
  onChangeText: (text: string) => void
}

function ComposeInputBase({ value, background, articleMode, onChangeText }: ComposeInputProps) {
  const { t } = useI18n()

  const active = POST_BACKGROUNDS.find((item) => item.id === background)
  const hero = Boolean(active) && background !== 'none'

  const limit = hero ? COMPOSE_LIMITS.backgroundText : COMPOSE_LIMITS.text
  const showCounter = value.length >= limit * COMPOSE_LIMITS.counterVisibleRatio

  const placeholder = articleMode
    ? t.news.compose.placeholderArticle
    : hero
      ? t.news.compose.placeholderBackground
      : t.news.compose.placeholder

  const field = (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={hero ? postColors.onMedia : postColors.textTertiary}
      maxLength={limit}
      multiline
      autoFocus={!hero}
      textAlignVertical={hero ? 'center' : 'top'}
      style={[
        styles.input,
        hero ? styles.inputHero : styles.inputPlain,
      ]}
    />
  )

  return (
    <View style={styles.block}>
      {hero && active ? (
        <LinearGradient
          colors={active.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {field}
        </LinearGradient>
      ) : (
        field
      )}

      {showCounter ? (
        <Text style={styles.counter}>{`${value.length} / ${limit}`}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { paddingTop: postSpacing.rowGap },
  input: { color: postColors.textPrimary },
  inputPlain: {
    minHeight: 120,
    paddingHorizontal: postSpacing.gutter,
    ...postType.composeInput,
  },
  inputHero: {
    minHeight: 200,
    paddingHorizontal: postSpacing.gutter * 2,
    textAlign: 'center',
    color: postColors.onMedia,
    ...postType.bodyHero,
  },
  hero: {
    marginHorizontal: postSpacing.gutter,
    borderRadius: postSpacing.gutter,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  counter: {
    alignSelf: 'flex-end',
    paddingHorizontal: postSpacing.gutter,
    paddingTop: postSpacing.inlineGap,
    color: postColors.textTertiary,
    ...postType.composeCounter,
  },
})

export const ComposeInput = memo(ComposeInputBase)
