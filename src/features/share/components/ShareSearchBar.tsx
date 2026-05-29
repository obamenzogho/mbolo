import { memo } from 'react'
import { View, TextInput, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface ShareSearchBarProps {
  value: string
  onChangeText: (text: string) => void
  onClear?: () => void
  placeholder?: string
}

function ShareSearchBarComponent({ value, onChangeText, onClear, placeholder = 'Rechercher...' }: ShareSearchBarProps) {
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1a1a2e',
      borderRadius: 12,
      marginHorizontal: 16,
      marginVertical: 8,
      paddingHorizontal: 12,
      height: 40,
    }}>
      <Ionicons name="search" size={18} color="#666" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#666"
        style={{
          flex: 1,
          color: '#FFF',
          fontSize: 14,
          marginLeft: 8,
          paddingVertical: 0,
        }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && onClear && (
        <TouchableOpacity onPress={onClear} style={{ padding: 4 }}>
          <Ionicons name="close-circle" size={18} color="#666" />
        </TouchableOpacity>
      )}
    </View>
  )
}

export const ShareSearchBar = memo(ShareSearchBarComponent)
