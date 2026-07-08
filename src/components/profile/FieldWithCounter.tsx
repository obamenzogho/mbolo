import { memo, useState, useCallback } from 'react'
import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native'
import { colors } from '@/lib/theme'

interface Props extends Omit<TextInputProps, 'style'> {
  label: string
  value: string
  maxLength?: number
  multiline?: boolean
}

export const FieldWithCounter = memo(function FieldWithCounter({ label, value, maxLength, multiline, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false)
  const len = value.length
  const nearLimit = maxLength ? len >= maxLength * 0.9 : false

  const handleFocus = useCallback(() => {
    setFocused(true)
    onFocus?.()
  }, [onFocus])

  const handleBlur = useCallback(() => {
    setFocused(false)
    onBlur?.()
  }, [onBlur])

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {maxLength ? (
          <Text style={[styles.counter, nearLimit && { color: colors.secondary }]}>
            {len}/{maxLength}
          </Text>
        ) : null}
      </View>
      <TextInput
        value={value}
        maxLength={maxLength}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          styles.input,
          multiline && { height: 80, textAlignVertical: 'top' },
          { borderColor: focused ? colors.primary : '#333' },
        ]}
        {...rest}
      />
    </View>
  )
})

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { color: colors.white, fontSize: 13, fontWeight: '600' },
  counter: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  input: { backgroundColor: '#111', color: colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
})
