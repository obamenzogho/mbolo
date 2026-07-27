import { useState, memo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'

const INITIAL_VISIBLE = 3

export const RecentSearches = memo(function RecentSearches({ recent, onSelect, onRemove, onClear }: {
  recent: string[]
  onSelect: (term: string) => void
  onRemove: (term: string) => void
  onClear: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (recent.length === 0) return null

  const visible = expanded ? recent : recent.slice(0, INITIAL_VISIBLE)
  const hasMore = recent.length > INITIAL_VISIBLE

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recherches récentes</Text>
        <TouchableOpacity onPress={onClear}>
          <Text style={styles.clearBtn}>Effacer</Text>
        </TouchableOpacity>
      </View>
      {visible.map((term) => (
        <TouchableOpacity
          key={term}
          style={styles.recentRow}
          onPress={() => onSelect(term)}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={18} color="#777" />
          <Text style={styles.recentTerm} numberOfLines={1}>{term}</Text>
          <TouchableOpacity
            onPress={() => onRemove(term)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color="#555" />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
      {hasMore && (
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={styles.moreText}>
            {expanded ? 'Voir moins' : `Voir tout (${recent.length})`}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.primary}
          />
        </TouchableOpacity>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { color: '#777', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  clearBtn: { color: colors.primary, fontSize: 13 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E1F22',
  },
  recentTerm: { flex: 1, color: '#fff', fontSize: 15 },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  moreText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
})
