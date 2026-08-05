import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import BottomSheet from '@/components/ui/BottomSheet'
import { useI18n } from '@/i18n'
import { createColors, createType } from '../theme/createTokens'
import { loadActiveSounds, type SoundRecord } from '../services/soundService'

interface SoundPickerSheetProps {
  visible: boolean
  selectedSoundId?: string
  onSelect: (sound: SoundRecord | null) => void
  onClose: () => void
}

export function SoundPickerSheet({
  visible,
  selectedSoundId,
  onSelect,
  onClose,
}: SoundPickerSheetProps) {
  const { t } = useI18n()
  const [sounds, setSounds] = useState<SoundRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    if (!visible) return

    setLoading(true)
    setLoadError(false)

    void loadActiveSounds(25)
      .then((items) => {
        if (!active) return
        setSounds(items)
      })
      .catch(() => {
        if (!active) return
        setLoadError(true)
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [visible])

  const handleSelect = useCallback(
    (sound: SoundRecord | null) => {
      onSelect(sound)
    },
    [onSelect],
  )

  return (
    <BottomSheet visible={visible} onClose={onClose} height="auto">
      <View style={styles.sheet}>
        <Text style={styles.title}>{t.news.compose.soundPickerTitle}</Text>

        {loading ? (
          <Text style={styles.message}>{t.news.compose.soundPickerLoading}</Text>
        ) : loadError ? (
          <Text style={styles.message}>{t.news.compose.soundPickerError}</Text>
        ) : sounds.length === 0 ? (
          <Text style={styles.message}>{t.news.compose.soundPickerEmpty}</Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {sounds.map((sound) => {
              const selected = sound.id === selectedSoundId

              return (
                <Pressable
                  key={sound.id}
                  onPress={() => handleSelect(sound)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                    selected && styles.rowSelected,
                  ]}
                >
                  <View style={styles.texts}>
                    <Text style={[styles.soundTitle, selected && styles.soundTitleSelected]}>
                      {sound.title}
                    </Text>
                    <Text style={styles.soundArtist} numberOfLines={1}>
                      {sound.artist}
                    </Text>
                  </View>
                  <Text style={styles.duration}>
                    {Math.ceil(sound.durationMs / 1000)}s
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        )}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  title: {
    color: createColors.textPrimary,
    ...createType.title,
    paddingVertical: 14,
  },
  message: {
    color: createColors.textSecondary,
    ...createType.caption,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: createColors.hairline,
  },
  rowSelected: {
    backgroundColor: createColors.surface,
  },
  texts: {
    flex: 1,
    marginRight: 12,
  },
  soundTitle: {
    color: createColors.textPrimary,
    ...createType.row,
  },
  soundTitleSelected: {
    color: createColors.accent,
  },
  soundArtist: {
    color: createColors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  duration: {
    color: createColors.textSecondary,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.75,
  },
})
