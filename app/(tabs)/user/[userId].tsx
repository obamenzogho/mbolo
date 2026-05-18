import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, Image, FlatList, Alert,
  Dimensions, RefreshControl, ScrollView, Modal, ActivityIndicator, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { auth, db } from '../../../src/lib/firebase'
import { colors } from '../../../src/lib/theme'
import type { User as UserType, Video as VideoType } from '../../../src/types'
import { useLocalSearchParams, router } from 'expo-router'
import { useFollow } from '../../../src/hooks/useFollow'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_COLS = 3
const ITEM_SIZE = SCREEN_WIDTH / GRID_COLS

function VideoThumbnailCell({ item }: { item: VideoType }) {
  const [thumb, setThumb] = useState<string | null>(null)
  const [loading, setLoading] = useState(!item.thumbnailURL)
  useEffect(() => {
    if (item.thumbnailURL) { setThumb(item.thumbnailURL); setLoading(false); return }
    let cancelled = false
    const gen = async () => {
      try {
        const { uri } = await require('expo-video-thumbnails').getThumbnailAsync(item.videoURL, { time: 1000, quality: 0.5 })
        if (!cancelled) { setThumb(uri); setLoading(false) }
      } catch { if (!cancelled) setLoading(false) }
    }
    gen()
    return () => { cancelled = true }
  }, [item.videoURL, item.thumbnailURL])
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => router.push({ pathname: '/(tabs)/feed', params: { videoId: item.id } })} style={{ width: ITEM_SIZE, height: ITEM_SIZE }}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} />
      ) : loading ? (
        <View style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="ellipsis-horizontal-outline" size={18} color="#444" />
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.4)" />
          {item.description ? <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 6, paddingHorizontal: 6, textAlign: 'center', lineHeight: 13 }} numberOfLines={2}>{item.description}</Text> : null}
        </View>
      )}
      {item.type === 'reel' && (
        <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 }}>
          <Ionicons name="film-outline" size={12} color="#fff" />
        </View>
      )}
      {item.views !== undefined && item.views > 0 && (
        <View style={{ position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Ionicons name="play" size={10} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{item.views >= 1000 ? `${(item.views / 1000).toFixed(1)}K` : item.views}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

function calcAge(dob: string): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age >= 0 ? age : null
}

export default function UserProfile() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const [profile, setProfile] = useState<UserType | null>(null)
  const [videos, setVideos] = useState<VideoType[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'grid' | 'reels'>('grid')
  const [followersModal, setFollowersModal] = useState(false)
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers')
  const [followListUsers, setFollowListUsers] = useState<any[]>([])
  const [followListLoading, setFollowListLoading] = useState(false)

  const { isFollowing, followerCount, followingCount, loading: followLoading, toggleFollow } = useFollow(userId || '')

  const loadProfile = useCallback(async () => {
    if (!userId) return
    try {
      const snap = await getDoc(doc(db, 'users', userId))
      if (snap.exists()) {
        setProfile(snap.data() as UserType)
      }
    } catch {}
  }, [userId])

  const loadVideos = useCallback(async () => {
    if (!userId) return
    try {
      const q = query(collection(db, 'videos'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(50))
      const snap = await getDocs(q)
      setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as VideoType[])
    } catch { setVideos([]) }
  }, [userId])

  useEffect(() => { loadProfile(); loadVideos() }, [loadProfile, loadVideos])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadProfile(), loadVideos()])
    setRefreshing(false)
  }, [loadProfile, loadVideos])

  const openFollowList = async (type: 'followers' | 'following') => {
    if (!profile) return
    setFollowListType(type)
    setFollowListLoading(true)
    setFollowersModal(true)
    try {
      const ids = type === 'followers' ? (profile.followers || []) : (profile.following || [])
      const users: any[] = []
      for (const id of ids.slice(0, 50)) {
        const snap = await getDoc(doc(db, 'users', id))
        if (snap.exists()) {
          users.push({ id: snap.id, ...snap.data() })
        }
      }
      setFollowListUsers(users)
    } catch {}
    setFollowListLoading(false)
  }

  const handleFollowUser = async (targetId: string) => {
    const currentUid = auth.currentUser?.uid
    if (!currentUid || !targetId) return
    const userRef = doc(db, 'users', currentUid)
    const targetRef = doc(db, 'users', targetId)
    const isCurrentlyFollowing = profile?.followers?.includes(currentUid) || false
    if (isCurrentlyFollowing) {
      try {
        await Promise.all([
          updateDoc(userRef, { following: arrayRemove(targetId) }),
          updateDoc(targetRef, { followers: arrayRemove(currentUid) }),
        ])
      } catch {}
    } else {
      try {
        await Promise.all([
          updateDoc(userRef, { following: arrayUnion(targetId) }),
          updateDoc(targetRef, { followers: arrayUnion(currentUid) }),
        ])
      } catch {}
    }
    await loadProfile()
    setFollowListUsers(prev => prev.map(u => {
      if (u.id === targetId) {
        const followers = u.followers || []
        return { ...u, followers: isCurrentlyFollowing ? followers.filter((id: string) => id !== currentUid) : [...followers, currentUid] }
      }
      return u
    }))
  }

  const currentVideos = activeTab === 'grid' ? videos : []

  const isOwnProfile = userId === auth.currentUser?.uid

  if (isOwnProfile) {
    router.replace('/(tabs)/profile')
    return null
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={currentVideos}
        numColumns={GRID_COLS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VideoThumbnailCell item={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
              <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, justifyContent: 'center' }}>
                <Ionicons name="chevron-back" size={26} color={colors.white} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>{profile?.pseudo || 'Utilisateur'}</Text>
              </View>
              <TouchableOpacity onPress={() => {}} style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-end' }}>
                <Ionicons name="ellipsis-vertical" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 }}>
              <View style={{ width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center' }}>
                {profile?.photoURL ? <Image source={{ uri: profile.photoURL }} style={{ width: 84, height: 84, borderRadius: 42 }} /> : <Ionicons name="person" size={40} color="#555" />}
              </View>
              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
                <TouchableOpacity style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{videos.length}</Text>
                  <Text style={{ color: '#888', fontSize: 12 }}>Vidéos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => openFollowList('followers')}>
                  <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{followerCount}</Text>
                  <Text style={{ color: '#888', fontSize: 12 }}>Abonnés</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => openFollowList('following')}>
                  <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{followingCount}</Text>
                  <Text style={{ color: '#888', fontSize: 12 }}>Abonnements</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: colors.white, fontSize: 14, fontWeight: '700' }}>{profile?.nom || ''}</Text>
                  {profile?.verified && <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />}
                </View>
                <Text style={{ color: '#888', fontSize: 13, marginTop: 1 }}>@{profile?.pseudo || 'utilisateur'}</Text>
                {profile?.category && <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>{profile.category}</Text>}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {profile?.city && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="location-outline" size={13} color="#888" />
                      <Text style={{ color: '#888', fontSize: 12 }}>{profile.city}</Text>
                    </View>
                  )}
                  {(() => { const age = calcAge(profile?.dateOfBirth || ''); return age && profile?.showAge !== false ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="calendar-outline" size={13} color="#888" /><Text style={{ color: '#888', fontSize: 12 }}>{age} ans</Text></View> : null })()}
                </View>
                {profile?.bio ? <Text style={{ color: colors.white, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{profile.bio}</Text> : null}
                {profile?.externalLinks && profile.externalLinks.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    {profile.externalLinks.map((link, i) => (
                      <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Ionicons name="link-outline" size={12} color={colors.secondary} />
                        <Text style={{ color: colors.secondary, fontSize: 12 }}>{link.url}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 16 }}>
              <TouchableOpacity
                onPress={toggleFollow}
                disabled={followLoading}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 8,
                  backgroundColor: isFollowing ? '#222' : colors.primary,
                  borderWidth: isFollowing ? 1 : 0,
                  borderColor: isFollowing ? '#444' : 'transparent',
                  alignItems: 'center',
                  opacity: followLoading ? 0.6 : 1,
                }}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={{ color: colors.white, fontSize: 14, fontWeight: '700' }}>
                    {isFollowing ? 'Abonné' : 'Suivre'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
                  backgroundColor: '#222', borderWidth: 1, borderColor: '#444',
                }}
                onPress={async () => {
                  try {
                    await Share.share({ message: `Découvre @${profile?.pseudo || 'utilisateur'} sur Mbolo ! 🇬🇦` })
                  } catch {}
                }}
              >
                <Ionicons name="person-add-outline" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#222' }}>
              <TouchableOpacity onPress={() => setActiveTab('grid')} style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                <Ionicons name="grid-outline" size={22} color={activeTab === 'grid' ? colors.white : '#555'} />
                {activeTab === 'grid' && <View style={{ position: 'absolute', bottom: 0, height: 2, width: 50, backgroundColor: colors.white, borderRadius: 1 }} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('reels')} style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                <Ionicons name="film-outline" size={22} color={activeTab === 'reels' ? colors.white : '#555'} />
                {activeTab === 'reels' && <View style={{ position: 'absolute', bottom: 0, height: 2, width: 50, backgroundColor: colors.white, borderRadius: 1 }} />}
              </TouchableOpacity>
            </View>

            {currentVideos.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 }}>
                <Ionicons name="grid-outline" size={48} color="#333" />
                <Text style={{ color: '#555', fontSize: 16, fontWeight: '600', marginTop: 12 }}>Aucune vidéo</Text>
                <Text style={{ color: '#555', fontSize: 13, marginTop: 4, textAlign: 'center' }}>Les vidéos de @{profile?.pseudo || 'utilisateur'} apparaîtront ici</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={null}
      />

      {/* FOLLOWERS/FOLLOWING MODAL */}
      <Modal visible={followersModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
            <TouchableOpacity onPress={() => setFollowersModal(false)} style={{ width: 36, height: 36, justifyContent: 'center' }}>
              <Ionicons name="close" size={26} color={colors.white} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>
                {followListType === 'followers' ? 'Abonnés' : 'Abonnements'}
              </Text>
            </View>
            <View style={{ width: 36 }} />
          </View>
          {followListLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : followListUsers.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="people-outline" size={48} color="#333" />
              <Text style={{ color: '#555', fontSize: 14, marginTop: 12 }}>Aucun {followListType === 'followers' ? 'abonné' : 'abonnement'}</Text>
            </View>
          ) : (
            <FlatList
              data={followListUsers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const isMe = item.id === auth.currentUser?.uid
                const isUserFollowing = item.followers?.includes(auth.currentUser?.uid) ?? false
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (!isMe) {
                        setFollowersModal(false)
                        router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.id } })
                      }
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}
                  >
                    {item.photoURL ? (
                      <Image source={{ uri: item.photoURL }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="person" size={24} color="#555" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>{item.nom || 'Utilisateur'}</Text>
                        {item.verified && <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />}
                      </View>
                      <Text style={{ color: '#888', fontSize: 13 }}>@{item.pseudo || 'utilisateur'}</Text>
                    </View>
                    {!isMe && (
                      <TouchableOpacity
                        onPress={() => handleFollowUser(item.id)}
                        style={{
                          paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6,
                          backgroundColor: isUserFollowing ? '#222' : colors.primary,
                          borderWidth: isUserFollowing ? 1 : 0,
                          borderColor: isUserFollowing ? '#444' : 'transparent',
                        }}
                      >
                        <Text style={{ color: colors.white, fontSize: 13, fontWeight: '600' }}>
                          {isUserFollowing ? 'Abonné' : 'Suivre'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                )
              }}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  )
}
