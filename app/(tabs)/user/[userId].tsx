import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, TouchableOpacity, Image, FlatList, ScrollView,
  Dimensions, Modal, Share, Alert,
} from 'react-native'

import {
  useSharedValue,
  useDerivedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../../../src/lib/firebase'
import { batchFetchUsers } from '../../../src/lib/firestore'
import { Avatar } from '../../../src/components/ui/Avatar'
import { colors } from '../../../src/lib/theme'
import { captureException } from '../../../src/lib/sentry'
import type { User as UserType, ProfileTab } from '../../../src/types'
import { useLocalSearchParams, router, Redirect } from 'expo-router'
import { useFollow } from '../../../src/hooks/useFollow'
import { useGoBack } from '../../../src/hooks/useGoBack'
import FollowButton from '../../../src/components/FollowButton'
import OrbitLoader from '../../../src/components/OrbitLoader'
import BottomSheet from '../../../src/components/ui/BottomSheet'
import { getOrCreateConversation } from '@/features/chat/services/chatService'
import { useProfileTabs } from '@/hooks/useProfileTabs'
import { ProfileTabBar } from '@/components/ProfileTabBar'
import { VideoGrid } from '@/components/VideoGrid'
import { ProfileVideoViewer } from '@/features/feed/profile-viewer/ProfileVideoViewer'
import { RichText } from '@/components/RichText'
import { VerifiedBadge } from '@/components/VerifiedBadge'
import { AvatarViewer } from '@/components/AvatarViewer'
import { ContentActionsSheet } from '@/components/ContentActionsSheet'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

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
  const { goBack } = useGoBack()
  const [profile, setProfile] = useState<UserType | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const tabsHook = useProfileTabs({ userId: userId || '', tabs: ['grid', 'reels'] })
  const { activeTab, setActiveTab, currentVideos, loading, refreshing, onRefresh: tabsRefresh, loadMore, hasMore } = tabsHook
  const [followersModal, setFollowersModal] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([
    { x: 0, width: 0 }, { x: 0, width: 0 },
  ])
  const [page, setPage] = useState(0)
  const [scrollOffsetX, setScrollOffsetX] = useState(0)
  const indicatorLeft = useMemo(() => {
    const pageFloat = Math.max(0, Math.min(scrollOffsetX / SCREEN_WIDTH, 1))
    const lower = Math.floor(pageFloat)
    const upper = Math.min(lower + 1, 1)
    const t = pageFloat - lower
    const l = tabLayouts[lower]
    const u = tabLayouts[upper]
    if (!l) return 0
    const lCenter = l.x + l.width / 2
    if (!u || upper === lower) return lCenter - 14
    const uCenter = u.x + u.width / 2
    return lCenter + t * (uCenter - lCenter) - 14
  }, [scrollOffsetX, tabLayouts])
  const [followListUsers, setFollowListUsers] = useState<any[]>([])
  const [followListLoading, setFollowListLoading] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [menuVisible, setMenuVisible] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)

  const { isFollowing, isFriend, followerCount, followingCount, loading: followLoading, toggleFollow } = useFollow(userId || '')

  useEffect(() => {
    if (!userId) return
    const unsub = onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserType)
          setImgError(false)
        }
        setProfileLoaded(true)
      },
      (error) => {
        captureException(error, { context: 'userProfile onSnapshot' })
        setProfileLoaded(true)
      },
    )
    return unsub
  }, [userId])

  useEffect(() => { if (profileLoaded && !loading) setReady(true) }, [profileLoaded, loading])

  const onRefresh = useCallback(async () => {
    await tabsRefresh()
  }, [tabsRefresh])

  const handleThumbnailPress = useCallback((videoId: string) => {
    const idx = currentVideos.findIndex(v => v.id === videoId)
    if (idx !== -1) setViewerIndex(idx)
  }, [currentVideos])

  const handleMessage = useCallback(async () => {
    if (!userId || !auth.currentUser?.uid) return
    const isSpam = isFollowing && !isFriend
    const conv = await getOrCreateConversation(auth.currentUser.uid, userId, isSpam)
    router.push({
      pathname: '/(tabs)/messages/conversation/[id]',
      params: { id: conv.id },
    })
  }, [userId, isFollowing, isFriend])

  const tabConfig: ProfileTab[] = ['grid', 'reels']

  const translateX = useSharedValue(0)
  const swipeOffsetPx = useDerivedValue(() => {
    'worklet'
    return -translateX.value / tabConfig.length
  })

  const handleTabChange = useCallback((tab: ProfileTab) => {
    setActiveTab(tab)
    translateX.value = 0
  }, [setActiveTab])

  const swipeGesture = Gesture.Pan()
    .minDistance(10)
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((e) => {
      translateX.value = e.translationX
    })
    .onEnd((e) => {
      const idx = tabConfig.indexOf(activeTab)
      const threshold = SCREEN_WIDTH * 0.2
      if (e.translationX < -threshold && idx < tabConfig.length - 1) {
        runOnJS(handleTabChange)(tabConfig[idx + 1])
      } else if (e.translationX > threshold && idx > 0) {
        runOnJS(handleTabChange)(tabConfig[idx - 1])
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 250 })
      }
    })

  const openFollowList = async (initialType: 'followers' | 'following') => {
    if (!profile) return
    const targetPage = initialType === 'followers' ? 0 : 1
    setPage(targetPage)
    setScrollOffsetX(targetPage * SCREEN_WIDTH)
    setFollowListLoading(true)
    setFollowersModal(true)
    try {
      const followerIds = profile.followers || []
      const followingIds = profile.following || []
      const allIds = [...new Set([...followerIds, ...followingIds])].slice(0, 50)
      const userMap = await batchFetchUsers(allIds)
      setFollowListUsers(Array.from(userMap.values()))
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'openFollowList-userFetch' }) }
    setFollowListLoading(false)
  }

  const closeFollowModal = useCallback(() => setFollowersModal(false), [])

  useEffect(() => {
    if (followersModal) {
      setTimeout(() => { scrollRef.current?.scrollTo({ x: page * SCREEN_WIDTH, animated: false }) }, 0)
    }
  }, [followersModal, page])

  const isOwnProfile = userId === auth.currentUser?.uid

  if (isOwnProfile) {
    return <Redirect href="/(tabs)/profile" />
  }

  if (!userId) return null

  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <GestureDetector gesture={swipeGesture}>
        <VideoGrid
          videos={currentVideos}
          tab={activeTab}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          loadMore={loadMore}
          hasMore={hasMore}
          onThumbnailPress={handleThumbnailPress}
          ListHeaderComponent={
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
                <TouchableOpacity onPress={goBack} style={{ width: 36, height: 36, justifyContent: 'center' }}>
                  <Ionicons name="chevron-back" size={26} color={colors.white} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>{profile?.pseudo || ''}</Text>
                </View>
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-end' }}>
                  <Ionicons name="ellipsis-vertical" size={22} color={colors.white} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 }}>
                <TouchableOpacity onPress={() => profile?.photoURL && setPhotoViewerVisible(true)} style={{ width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center' }}>
                  {profile?.photoURL && !imgError ? (
                    <Image source={{ uri: profile.photoURL }} onError={() => setImgError(true)} style={{ width: 84, height: 84, borderRadius: 42 }} />
                  ) : <Ionicons name="person" size={40} color="#555" />}
                </TouchableOpacity>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
                  <TouchableOpacity style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{currentVideos.length}</Text>
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
                    {profile?.verified && <VerifiedBadge size={14} />}
                    {isFriend && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4, backgroundColor: colors.success + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Ionicons name="people" size={12} color={colors.success} />
                        <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>
                          {profile?.genre === 'femme' ? 'Amie' : 'Ami'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: '#888', fontSize: 13, marginTop: 1 }}>@{profile?.pseudo || ''}</Text>
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
                    {profile?.bio ? <RichText text={profile.bio} style={{ color: colors.white, fontSize: 13, marginTop: 4, lineHeight: 18 }} /> : null}
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
                <FollowButton targetUserId={userId || ''} size="lg" style={{ flex: 1 }} />
                {(isFriend || isFollowing) && (
                  <TouchableOpacity
                    onPress={handleMessage}
                    style={{
                      paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8,
                      backgroundColor: '#222', borderWidth: 1, borderColor: '#444',
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses" size={18} color={colors.white} />
                    <Text style={{ color: colors.white, fontSize: 13, fontWeight: '600' }}>Message</Text>
                  </TouchableOpacity>
                )}
              </View>

              <ProfileTabBar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                tabs={tabConfig}
                swipeOffsetPx={swipeOffsetPx}
              />
            </View>
          }
          />
      </GestureDetector>

      {/* MENU MODAL */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View
            style={{
              backgroundColor: '#111',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 16,
              paddingBottom: 40,
              paddingHorizontal: 20,
            }}
          >
            <View style={{ width: 40, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}
              onPress={() => {
                setMenuVisible(false)
                Share.share({ message: `Découvre @${profile?.pseudo || ''} sur Mbolo !` }).catch(() => {})
              }}
            >
              <Ionicons name="share-outline" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 16 }}>Partager le profil</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: '#222' }} />
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}
              onPress={() => {
                setMenuVisible(false)
                setActionsOpen(true)
              }}
            >
              <Ionicons name="flag-outline" size={22} color="#ff4444" />
              <Text style={{ color: '#ff4444', fontSize: 16 }}>Signaler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FOLLOWERS/FOLLOWING MODAL */}
      <BottomSheet visible={followersModal} onClose={closeFollowModal} height={SCREEN_HEIGHT * 0.85}>
        {/* Tab bar */}
        <View style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24 }}>
            <TouchableOpacity onLayout={(e) => { const { x, width } = e.nativeEvent.layout; setTabLayouts(prev => { const n = [...prev]; n[0] = { x, width }; return n }) }} onPress={() => { setPage(0); scrollRef.current?.scrollTo({ x: 0, animated: true }) }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: page === 0 ? colors.white : '#666' }}>Abonnés</Text>
            </TouchableOpacity>
            <TouchableOpacity onLayout={(e) => { const { x, width } = e.nativeEvent.layout; setTabLayouts(prev => { const n = [...prev]; n[1] = { x, width }; return n }) }} onPress={() => { setPage(1); scrollRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: true }) }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: page === 1 ? colors.white : '#666' }}>Abonnements</Text>
            </TouchableOpacity>
            <View style={{
              position: 'absolute', bottom: -10, height: 3, width: 28,
              backgroundColor: colors.primary, borderRadius: 1.5,
              left: indicatorLeft,
            }} />
          </View>
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => { setScrollOffsetX(e.nativeEvent.contentOffset.x) }}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x
            setScrollOffsetX(x)
            setPage(Math.round(x / SCREEN_WIDTH))
          }}
          style={{ flex: 1 }}
        >
          {/* Abonnés */}
          <View key="followers" style={{ width: SCREEN_WIDTH }}>
            <FlatList
              data={followListLoading ? [] : followListUsers.filter(u => profile?.followers?.includes(u.id))}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                followListLoading ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
                    <OrbitLoader size={80} />
                  </View>
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
                    <Ionicons name="people-outline" size={48} color="#333" />
                    <Text style={{ color: '#555', fontSize: 14, marginTop: 12 }}>Aucun abonné</Text>
                  </View>
                )
              }
              renderItem={({ item }) => {
                const isMe = item.id === auth.currentUser?.uid
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (!isMe) {
                        closeFollowModal()
                        setTimeout(() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.id } }), 300)
                      }
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}
                  >
                    <Avatar uri={item.photoURL} name={item.nom || item.pseudo} size={44} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600', height: 20, lineHeight: 20 }}>{item.nom || ''}</Text>
                        {item.verified && <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />}
                      </View>
                      <Text style={{ color: '#888', fontSize: 13, height: 18, lineHeight: 18 }}>@{item.pseudo || ''}</Text>
                    </View>
                    {!isMe && <FollowButton targetUserId={item.id} size="sm" />}
                  </TouchableOpacity>
                )
              }}
            />
          </View>
          {/* Abonnements */}
          <View key="following" style={{ width: SCREEN_WIDTH }}>
            <FlatList
              data={followListLoading ? [] : followListUsers.filter(u => profile?.following?.includes(u.id))}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={
                followListLoading ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
                    <OrbitLoader size={80} />
                  </View>
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
                    <Ionicons name="people-outline" size={48} color="#333" />
                    <Text style={{ color: '#555', fontSize: 14, marginTop: 12 }}>Aucun abonnement</Text>
                  </View>
                )
              }
              renderItem={({ item }) => {
                const isMe = item.id === auth.currentUser?.uid
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (!isMe) {
                        closeFollowModal()
                        setTimeout(() => router.push({ pathname: '/(tabs)/user/[userId]', params: { userId: item.id } }), 300)
                      }
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}
                  >
                    <Avatar uri={item.photoURL} name={item.nom || item.pseudo} size={44} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600', height: 20, lineHeight: 20 }}>{item.nom || ''}</Text>
                        {item.verified && <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />}
                      </View>
                      <Text style={{ color: '#888', fontSize: 13, height: 18, lineHeight: 18 }}>@{item.pseudo || ''}</Text>
                    </View>
                    {!isMe && <FollowButton targetUserId={item.id} size="sm" />}
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </ScrollView>
      </BottomSheet>
      {viewerIndex !== null && (
        <ProfileVideoViewer
          videos={currentVideos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          userId={userId || ''}
          profileUser={{ nom: profile?.nom, photoURL: profile?.photoURL }}
        />
      )}
      <AvatarViewer
        uri={profile?.photoURL || ''}
        visible={photoViewerVisible}
        onClose={() => setPhotoViewerVisible(false)}
      />
      <ContentActionsSheet
        visible={actionsOpen}
        targetType="user"
        targetId={userId || ''}
        contentOwnerId={userId}
        contentOwnerName={profile?.pseudo}
        onClose={() => setActionsOpen(false)}
      />
    </SafeAreaView>
  )
}
