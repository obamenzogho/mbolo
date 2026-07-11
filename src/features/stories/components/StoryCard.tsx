import { memo } from 'react'
import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/lib/theme'
import type { StoryGroup } from '../hooks/useStoriesFeed'

const CARD_W = 108
const CARD_H = 168

interface StoryCardProps {
  group: StoryGroup
  onPress: () => void
}

function StoryCardComponent({ group, onPress }: StoryCardProps) {
  const preview = group.stories[group.firstUnseenIndex] ?? group.stories[0]
  const isImage = preview?.mediaType === 'image'

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {isImage && preview?.mediaUrl ? (
        <Image source={{ uri: preview.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={['#2A2C31', '#141518']} style={StyleSheet.absoluteFill}>
          <View style={styles.videoIcon}>
            <Ionicons name="play-circle" size={30} color="rgba(255,255,255,0.85)" />
          </View>
        </LinearGradient>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.65)']}
        style={styles.bottomVeil}
      />

      <View style={[styles.avatarRing, { borderColor: group.hasUnseen ? colors.primary : '#8A8A8A' }]}>
        {group.avatarUrl ? (
          <Image source={{ uri: group.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={16} color="#999" />
          </View>
        )}
      </View>

      <Text numberOfLines={1} style={styles.name}>{group.username}</Text>
    </Pressable>
  )
}

interface CreateStoryCardProps {
  avatarUrl?: string
  onPress: () => void
}

export function CreateStoryCard({ avatarUrl, onPress }: CreateStoryCardProps) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.createTop} resizeMode="cover" />
      ) : (
        <View style={[styles.createTop, styles.avatarFallback]}>
          <Ionicons name="person" size={34} color="#999" />
        </View>
      )}
      <View style={styles.createBottom}>
        <View style={styles.createPlus}>
          <Ionicons name="add" size={20} color="#fff" />
        </View>
        <Text numberOfLines={1} style={styles.createLabel}>Créer une story</Text>
      </View>
    </Pressable>
  )
}

export const StoryCard = memo(StoryCardComponent)

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    marginRight: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1A1B1E',
  },
  videoIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomVeil: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },
  avatarRing: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    padding: 2,
    backgroundColor: '#141518',
  },
  avatar: { width: '100%', height: '100%', borderRadius: 18 },
  avatarFallback: { backgroundColor: '#25272A', alignItems: 'center', justifyContent: 'center' },
  name: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  createTop: { width: '100%', height: CARD_H - 46 },
  createBottom: {
    flex: 1,
    backgroundColor: '#1A1B1E',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  createPlus: {
    position: 'absolute',
    top: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#1A1B1E',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLabel: { color: '#E8E8E8', fontSize: 11, fontWeight: '600' },
})
