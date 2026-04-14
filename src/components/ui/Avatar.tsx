import { View, Image, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'

interface AvatarProps {
  uri?: string
  name?: string
  size: number
  borderWidth?: number
  borderColor?: string
  onPress?: () => void
}

export function Avatar({ uri, name, size, borderWidth = 0, borderColor = 'transparent', onPress }: AvatarProps) {
  const content = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth,
        borderColor,
        overflow: 'hidden',
        backgroundColor: uri ? undefined : '#1A1B1E',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: '#1A1B1E',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="person" size={size * 0.5} color="#555" />
        </View>
      )}
    </View>
  )

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>
  }

  return content
}
