import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { auth } from '@/lib/firebase'
import { colors } from '@/lib/theme'
import { useFollowFast } from '@/hooks/useFollowFast'
import { useFollowAction } from '@/hooks/useFollowAction'
import type { Video } from '@/types'

// Longueur de description affichée sur une ligne avant « voir plus ».
const DESC_MAX = 70

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
  const [expanded, setExpanded] = useState(false)
  const followTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(followTimer.current), [])

  const goToProfile = useCallback(() => {
    router.push({ pathname: '/(tabs)/(sub)/user/[userId]', params: { userId: item.userId } })
  }, [item.userId])

  const handleFollow = useCallback(() => {
    if (followState !== 'idle') return
    toggleFollow(item.userId)
    setFollowState('done')
    clearTimeout(followTimer.current)
    followTimer.current = setTimeout(() => setFollowState('hidden'), 2000)
  }, [followState, toggleFollow, item.userId])

  // Style Facebook : la description est le contenu principal, affichée sous le
  // NOM (pas sous l'avatar). Les hashtags sont repliés dans la description et
  // n'apparaissent qu'au déroulé (« voir plus »).
  const description = item.description?.trim() ?? ''
  const hasHashtags = !!hashtags && hashtags.length > 0
  const isLongDesc = description.length > DESC_MAX
  const canExpand = isLongDesc || hasHashtags
  const shownDesc = expanded || !isLongDesc
    ? description
    : description.slice(0, DESC_MAX).trimEnd() + '… '

  return (
    <View style={styles.root}>
      {!isOwn && !isFollowing && followState !== 'hidden' && (
        <TouchableOpacity style={styles.followPill} onPress={handleFollow} activeOpacity={0.85}>
          <Ionicons
            name={followState === 'done' ? 'checkmark' : 'add'}
            size={15}
            color="#000"
          />
          <Text style={styles.followPillText}>
            {followState === 'done' ? 'Suivi' : 'Suivre'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.userRow}>
        <TouchableOpacity onPress={goToProfile}>
          {avatarURL ? (
            <Image source={{ uri: avatarURL }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.rightCol}>
          <TouchableOpacity onPress={goToProfile} activeOpacity={0.8}>
            <Text style={styles.displayName}>{displayName}</Text>
          </TouchableOpacity>

          {(description.length > 0 || hasHashtags) && (
            <TouchableOpacity activeOpacity={0.9} onPress={() => canExpand && setExpanded((p) => !p)}>
              {description.length > 0 ? (
                <Text style={styles.description} numberOfLines={expanded ? undefined : 1}>
                  {shownDesc}
                  {!expanded && canExpand && <Text style={styles.more}>voir plus</Text>}
                </Text>
              ) : (
                !expanded && (
                  <Text style={styles.more}>Voir les hashtags</Text>
                )
              )}

              {expanded && hasHashtags && (
                <View style={styles.hashtagsRow}>
                  {hashtags!.map((t) => (
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

              {expanded && canExpand && (
                <Text style={styles.moreLine}>voir moins</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Seule la ligne « son / musique » passe SOUS la photo de profil (pleine
          largeur), le nom et la description restant à côté de l'avatar. */}
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
  root: { alignSelf: 'stretch', width: '100%' },
  userRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  rightCol: { flex: 1, marginLeft: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  followPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3,
    backgroundColor: colors.accent, borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  followPillText: { color: '#000', fontSize: 13, fontWeight: '700' },
  displayName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  description: { color: '#FFF', fontSize: 14, lineHeight: 19, marginTop: 3 },
  more: { color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '700' },
  moreLine: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontWeight: '700', marginTop: 4 },
  audioRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  disc: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  audioText: { color: '#FFF', fontSize: 13, flexShrink: 1 },
  hashtagsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6, gap: 4 },
  hashtag: { color: '#4FC3F7', fontSize: 13, fontWeight: '600' },
})
