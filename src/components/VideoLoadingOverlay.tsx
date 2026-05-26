import { View, Text, StyleSheet } from 'react-native'
import MboloLoader from './MboloLoader'

export default function VideoLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <View
      style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
      }}
    >
      <MboloLoader size={48} />
      <Text
        style={{
          color: '#888',
          fontSize: 13,
          marginTop: 16,
          letterSpacing: 0.5,
        }}
      >
        Chargement...
      </Text>
    </View>
  )
}
