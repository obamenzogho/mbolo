/* src/features/news/components/compose/ArticleEditor.tsx
   Mode article : couverture, titre, corps long. La saisie principale de
   l'écran devient l'accroche affichée dans le fil ; le corps vit ici. */

import { memo } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import {
  COMPOSE_LIMITS,
  HIT_SLOP,
  postColors,
  postMotion,
  postRadius,
  postSpacing,
  postType,
} from '../../theme/postTokens'

interface ArticleEditorProps {
  title: string
  body: string
  coverImage: string | null
  onChangeTitle: (title: string) => void
  onChangeBody: (body: string) => void
  onPickCover: () => void
  onRemoveCover: () => void
  onRemove: () => void
}

function ArticleEditorBase({
  title,
  body,
  coverImage,
  onChangeTitle,
  onChangeBody,
  onPickCover,
  onRemoveCover,
  onRemove,
}: ArticleEditorProps) {
  const { t } = useI18n()

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Ionicons name="document-text" size={16} color={postColors.optionArticle} />
        <Text style={styles.headTitle}>{t.news.compose.articleLabel}</Text>
        <Pressable
          onPress={onRemove}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t.news.compose.articleRemove}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons name="close" size={18} color={postColors.textSecondary} />
        </Pressable>
      </View>

      {coverImage ? (
        <View style={styles.cover}>
          <Image
            source={{ uri: coverImage }}
            style={styles.coverImage}
            contentFit="cover"
            transition={postMotion.imageTransition}
          />
          <Pressable
            onPress={onRemoveCover}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t.news.compose.mediaRemove}
            style={({ pressed }) => [styles.coverRemove, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={15} color={postColors.onMedia} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={onPickCover}
          accessibilityRole="button"
          style={({ pressed }) => [styles.dropzone, pressed && styles.pressed]}
        >
          <Ionicons name="image-outline" size={22} color={postColors.textSecondary} />
          <Text style={styles.dropzoneText}>{t.news.compose.articleCoverAdd}</Text>
        </Pressable>
      )}

      <TextInput
        value={title}
        onChangeText={onChangeTitle}
        placeholder={t.news.compose.articleTitlePlaceholder}
        placeholderTextColor={postColors.textTertiary}
        maxLength={COMPOSE_LIMITS.articleTitle}
        style={styles.title}
      />

      <TextInput
        value={body}
        onChangeText={onChangeBody}
        placeholder={t.news.compose.placeholderArticle}
        placeholderTextColor={postColors.textTertiary}
        maxLength={COMPOSE_LIMITS.articleBody}
        multiline
        textAlignVertical="top"
        style={styles.body}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    marginHorizontal: postSpacing.gutter,
    marginBottom: postSpacing.blockBottom,
    padding: postSpacing.gutter,
    gap: postSpacing.rowGap,
    borderRadius: postRadius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: postColors.inputBorder,
    backgroundColor: postColors.surface,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: postSpacing.inlineGap },
  headTitle: { flex: 1, color: postColors.textPrimary, ...postType.composeSection },
  cover: { borderRadius: postRadius.input, overflow: 'hidden' },
  coverImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: postColors.mediaPlaceholder,
  },
  coverRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: postColors.scrim,
  },
  dropzone: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: postSpacing.inlineGap,
    paddingVertical: 26,
    borderRadius: postRadius.input,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: postColors.dropzoneBorder,
  },
  dropzoneText: { color: postColors.textSecondary, ...postType.composeOption },
  title: {
    color: postColors.textPrimary,
    ...postType.composeTitle,
    paddingVertical: 4,
  },
  body: {
    minHeight: 160,
    color: postColors.textPrimary,
    ...postType.body,
  },
  pressed: { opacity: postMotion.pressedOpacity },
})

export const ArticleEditor = memo(ArticleEditorBase)
