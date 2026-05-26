import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'
import type { Highlight } from '@/features/highlights/services/highlightService'

interface HighlightRowProps {
  highlights: Highlight[]
  onAdd: () => void
  onPress: (hl: Highlight) => void
  onEdit: (hl: Highlight) => void
  onDelete: (hl: Highlight) => void
}

export function HighlightRow({ highlights, onAdd, onPress, onEdit, onDelete }: HighlightRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ paddingVertical: 16, paddingLeft: 16 }}
      contentContainerStyle={{ gap: 14 }}
    >
      <TouchableOpacity onPress={onAdd} style={{ alignItems: 'center' }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32,
          borderWidth: 1.5, borderColor: '#444', borderStyle: 'dashed',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name="add" size={28} color="#888" />
        </View>
        <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>Nouveau</Text>
      </TouchableOpacity>
      {highlights.map((hl) => (
        <TouchableOpacity
          key={hl.id}
          onPress={() => onPress(hl)}
          onLongPress={() =>
            Alert.alert(hl.title, 'Que veux-tu faire ?', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Modifier', onPress: () => onEdit(hl) },
              { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(hl) },
            ])
          }
          activeOpacity={0.7}
          style={{ alignItems: 'center' }}
        >
          <View style={{
            width: 64, height: 64, borderRadius: 32,
            borderWidth: 2, borderColor: '#3A75C4',
            overflow: 'hidden', justifyContent: 'center',
            alignItems: 'center', backgroundColor: '#111',
          }}>
            {hl.coverUrl ? (
              <Image source={{ uri: hl.coverUrl }} style={{ width: 60, height: 60, borderRadius: 30 }} />
            ) : (
              <Ionicons name="star-outline" size={28} color="#3A75C4" />
            )}
          </View>
          <Text
            style={{ color: '#ccc', fontSize: 11, marginTop: 4, maxWidth: 64 }}
            numberOfLines={1}
          >
            {hl.title}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}
