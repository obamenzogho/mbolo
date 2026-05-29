import { memo } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface ShareUserCardProps {
  id: string
  pseudo: string
  nom?: string
  photoURL?: string
  reason?: string
  onPress: (userId: string) => void
}

function ShareUserCardComponent({ id, pseudo, nom, reason, onPress }: ShareUserCardProps) {
  const initial = (pseudo || nom || '?').charAt(0).toUpperCase()

  return (
    <TouchableOpacity
      onPress={() => onPress(id)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <View style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#2a2a2a',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>{pseudo || nom || 'Utilisateur'}</Text>
        {nom && <Text style={{ color: '#888', fontSize: 12, marginTop: 1 }}>{nom}</Text>}
        {reason && (
          <Text style={{ color: '#00C853', fontSize: 11, marginTop: 1 }}>{reason}</Text>
        )}
      </View>
      <Ionicons name="send" size={18} color="#00C853" />
    </TouchableOpacity>
  )
}

export const ShareUserCard = memo(ShareUserCardComponent)
