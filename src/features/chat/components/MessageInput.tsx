import { useState } from 'react'
import { View, TextInput, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

interface MessageInputProps {
  onSend: (text: string) => void
  value?: string
  onChangeText?: (text: string) => void
  placeholder?: string
}

export function MessageInput({ onSend, value: controlledValue, onChangeText, placeholder = 'Écris un message...' }: MessageInputProps) {
  const [internalValue, setInternalValue] = useState('')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue
  const setValue = isControlled ? (onChangeText || (() => {})) : setInternalValue

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    if (!isControlled) setInternalValue('')
  }

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
      borderTopWidth: 0.5, borderTopColor: '#222', backgroundColor: '#000',
    }}>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor="#555"
        multiline
        style={{
          flex: 1, color: colors.white, fontSize: 15, maxHeight: 100,
          backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      />
      <TouchableOpacity
        onPress={handleSend}
        disabled={!value.trim()}
        style={{
          width: 38, height: 38, borderRadius: 19, backgroundColor: value.trim() ? colors.primary : '#333',
          justifyContent: 'center', alignItems: 'center', marginLeft: 8,
        }}
      >
        <Ionicons name="send" size={16} color={colors.white} />
      </TouchableOpacity>
    </View>
  )
}
