/* ReactionPicker — sélecteur de réactions emoji (long press).
   Affiche une rangée de 4 emojis avec animation spring. */

import { useState, useCallback } from 'react'
import { View, Pressable, Text, Modal, StyleSheet, Animated, Easing } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useHaptics } from '../../../hooks/useHaptics'
import { REACTION_EMOJI, REACTION_LABELS, type PostReactionType } from '../types'

interface ReactionPickerProps {
  visible: boolean
  onSelect: (type: PostReactionType) => void
  onClose: () => void
}

const REACTIONS: PostReactionType[] = ['like', 'love', 'fire', 'clap']

export function ReactionPicker({ visible, onSelect, onClose }: ReactionPickerProps) {
  const { lightImpact } = useHaptics()
  const [hoveredReaction, setHoveredReaction] = useState<PostReactionType | null>(null)

  const handleSelect = useCallback((type: PostReactionType) => {
    lightImpact()
    onSelect(type)
    onClose()
  }, [onSelect, onClose, lightImpact])

  if (!visible) return null

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.container}>
          {REACTIONS.map((type) => (
            <Pressable
              key={type}
              onPress={() => handleSelect(type)}
              onPressIn={() => setHoveredReaction(type)}
              onPressOut={() => setHoveredReaction(null)}
              style={[
                styles.emojiBubble,
                hoveredReaction === type && styles.emojiBubbleHovered,
              ]}
            >
              <Text style={styles.emoji}>{REACTION_EMOJI[type]}</Text>
              <Text style={styles.label}>{REACTION_LABELS[type]}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingBottom: 60,
    paddingHorizontal: 16,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#1C1C1E',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emojiBubble: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  emojiBubbleHovered: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    transform: [{ scale: 1.15 }],
  },
  emoji: {
    fontSize: 28,
  },
  label: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
})
