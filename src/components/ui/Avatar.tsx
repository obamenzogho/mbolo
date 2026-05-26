import { View, Text, Image, TouchableOpacity } from 'react-native'
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
  const initial = (name || 'U')[0].toUpperCase()

  const content = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth,
        borderColor,
        overflow: 'hidden',
        backgroundColor: uri ? undefined : colors.primary,
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
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>
            {initial}
          </Text>
        </View>
      )}
    </View>
  )

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>
  }

  return content
}
