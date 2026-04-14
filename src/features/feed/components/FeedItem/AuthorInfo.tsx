import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { auth } from '@/lib/firebase'
import { useFollowFast } from '@/hooks/useFollowFast'
import { useFollowAction } from '@/hooks/useFollowAction'
import type { Video } from '@/types'

interface AuthorInfoProps {
  item: Video
  username?: string
  userPhotoURL?: string
  hashtags?: string[]
}

export const AuthorInfo = memo(function AuthorInfo({ item, username, userPhotoURL, hashtags }: AuthorInfoProps) {
  const currentUserId = auth.currentUser?.uid ?? ''
  const displayName = item.userName ?? username ?? 'Utilisateur'
  const avatarURL = item.userPhotoURL || userPhotoURL
  const isOwn = item.userId === currentUserId

  const { isFollowing } = useFollowFast(item.userId)
  const { toggleFollow } = useFollowAction()
  const [followState, setFollowState] = useState<'idle' | 'done' | 'hidden'>('idle')
  const followTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(followTimer.current), [])

  const goToProfile = useCallback(() => {
    router.push({ pathname: '/user/[userId]', params: { userId: item.userId } })
  }, [item.userId])

  const handleFollow = useCallback(() => {
    if (followState !== 'idle') return
    toggleFollow(item.userId)
    setFollowState('done')
    clearTimeout(followTimer.current)
    followTimer.current = setTimeout(() => setFollowState('hidden'), 2000)
  }, [followState, toggleFollow, item.userId])

  return (
    <View>
      <View style={styles.userRow}>
        <View style={styles.avatarWrapper}>
          {!isOwn && !isFollowing && followState !== 'hidden' && (
            <TouchableOpacity style={styles.followBtn} onPress={handleFollow}>
              <Ionicons
                name={followState === 'done' ? 'checkmark' : 'add'}
                size={16}
                color="#FFF"
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={goToProfile}>
            {avatarURL ? (
              <Image source={{ uri: avatarURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={goToProfile} style={{ marginLeft: 10 }}>
          <Text style={styles.displayName}>{displayName}</Text>
        </TouchableOpacity>
      </View>

      {hashtags && hashtags.length > 0 && (
        <View style={styles.hashtagsRow}>
          {hashtags.map((t) => (
            <Text
              key={t}
              style={styles.hashtag}
              onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag: t } })}
            >
              #{t}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.audioRow}>
        <View style={styles.disc}>
          <Ionicons name="musical-notes" size={14} color="#FFF" />
        </View>
        <Text style={styles.audioText} numberOfLines={1}>Son original · {displayName}</Text>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatarWrapper: { alignItems: 'center', position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  followBtn: {
    position: 'absolute', top: -32, alignSelf: 'center',
    backgroundColor: '#00C853', width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  displayName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  audioRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, maxWidth: '80%' },
  disc: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  audioText: { color: '#FFF', fontSize: 13, flexShrink: 1 },
  hashtagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 },
  hashtag: { color: '#4FC3F7', fontSize: 13, fontWeight: '600' },
})
