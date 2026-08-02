/* src/features/news/components/compose/PollEditor.tsx
   Éditeur de sondage. Deux options minimum toujours présentes, quatre au
   maximum : au-delà, les barres de résultat deviennent illisibles dans le fil. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import {
  COMPOSE_LIMITS,
  HIT_SLOP,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  postColors,
  postMotion,
  postRadius,
  postSpacing,
  postType,
} from '../../theme/postTokens'
import type { NewsPoll } from '../../types'

interface PollEditorProps {
  poll: NewsPoll
  onChangeQuestion: (question: string) => void
  onChangeOption: (id: string, text: string) => void
  onAddOption: () => void
  onRemoveOption: (id: string) => void
  onRemove: () => void
}

function PollEditorBase({
  poll,
  onChangeQuestion,
  onChangeOption,
  onAddOption,
  onRemoveOption,
  onRemove,
}: PollEditorProps) {
  const { t } = useI18n()

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Ionicons name="stats-chart" size={16} color={postColors.optionPoll} />
        <Text style={styles.title}>{t.news.compose.pollTitle}</Text>
        <Pressable
          onPress={onRemove}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.pollRemove}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons name="close" size={18} color={postColors.textSecondary} />
        </Pressable>
      </View>

      <TextInput
        value={poll.question}
        onChangeText={onChangeQuestion}
        placeholder={t.news.compose.pollQuestion}
        placeholderTextColor={postColors.textTertiary}
        maxLength={COMPOSE_LIMITS.pollQuestion}
        style={[styles.input, styles.question]}
      />

      {poll.options.map((option, index) => (
        <View key={option.id} style={styles.optionRow}>
          <TextInput
            value={option.text}
            onChangeText={(text) => onChangeOption(option.id, text)}
            placeholder={t.news.compose.pollOption.replace('{n}', String(index + 1))}
            placeholderTextColor={postColors.textTertiary}
            maxLength={COMPOSE_LIMITS.pollOption}
            style={[styles.input, styles.option]}
          />
          {poll.options.length > POLL_MIN_OPTIONS ? (
            <Pressable
              onPress={() => onRemoveOption(option.id)}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={t.news.compose.pollRemove}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="remove-circle-outline" size={20} color={postColors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      ))}

      {poll.options.length < POLL_MAX_OPTIONS ? (
        <Pressable
          onPress={onAddOption}
          accessibilityRole="button"
          style={({ pressed }) => [styles.addOption, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={16} color={postColors.accent} />
          <Text style={styles.addOptionText}>{t.news.compose.pollAddOption}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    marginHorizontal: postSpacing.gutter,
    marginBottom: postSpacing.blockBottom,
    padding: postSpacing.gutter,
    gap: postSpacing.inlineGap,
    borderRadius: postRadius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: postColors.inputBorder,
    backgroundColor: postColors.surface,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: postSpacing.inlineGap,
    marginBottom: 2,
  },
  title: { flex: 1, color: postColors.textPrimary, ...postType.composeSection },
  input: {
    color: postColors.textPrimary,
    borderRadius: postRadius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: postColors.inputBorder,
    backgroundColor: postColors.inputSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  question: { ...postType.composeOption },
  option: { flex: 1, ...postType.body },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: postSpacing.inlineGap },
  addOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  addOptionText: { color: postColors.accent, ...postType.link },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const PollEditor = memo(PollEditorBase)
