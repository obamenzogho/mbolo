import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { router, useFocusEffect, useRouter } from 'expo-router'
import {
  View, Text, TouchableOpacity, Image, FlatList, Alert, TextInput,
  Dimensions, RefreshControl, ScrollView, Modal, Animated, Share,
  ActivityIndicator, StyleSheet,
} from 'react-native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import {
  useSharedValue,
  withSpring,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc, deleteDoc, setDoc,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'

import { auth, db } from '../../src/lib/firebase'
import { batchFetchUsers } from '../../src/lib/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useStartupStore } from '../../src/features/startup/store/startupStore'
import { uploadToCloudinary } from '../../src/lib/cloudinary'
import FollowButton from '../../src/components/FollowButton'
import OrbitLoader from '../../src/components/OrbitLoader'
import BottomSheet from '../../src/components/ui/BottomSheet'
import { Avatar } from '../../src/components/ui/Avatar'
import { colors } from '../../src/lib/theme'
import { captureException } from '../../src/lib/sentry'
import { withFirestoreRetry } from '../../src/lib/firestoreRetry'
import QueryErrorMessage, { getIndexErrorMessage } from '../../src/components/ui/QueryErrorMessage'
import QRCodeView from '../../src/components/QRCodeView'
import type { User as UserType, Video as VideoType }
from '../../src/types'
import type { ProfileTab } from '@/types'
import PageWrapper from '../../src/components/PageWrapper'
import { useCreateModal } from '../../src/contexts/CreateModalContext'
import { useFollow } from '../../src/hooks/useFollow'
import { HighlightRow } from '@/features/highlights/components/HighlightRow'
import { HighlightViewer } from '@/features/highlights/components/HighlightViewer'
import HighlightEditSheet from '@/features/highlights/components/HighlightEditSheet'
import { useProfileTabs } from '@/hooks/useProfileTabs'
import { ProfileTabBar } from '@/components/ProfileTabBar'
import { RichText } from '@/components/RichText'
import { VideoGrid } from '@/components/VideoGrid'
import { ProfileVideoViewer } from '@/features/feed/profile-viewer/ProfileVideoViewer'
import { AvatarViewer } from '@/components/AvatarViewer'
import { VerifiedBadge } from '@/components/VerifiedBadge'

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

export default function Profile() {
  const router = useRouter()
  const { openCreateModal } = useCreateModal()
  const [profile, setProfile] = useState<UserType | null>(null)
  const user = auth.currentUser
  const { acceptFollowRequest, rejectFollowRequest } = useFollow(user?.uid || '')
  const tabsHook = useProfileTabs({ userId: user?.uid || '' })
  const { activeTab, setActiveTab, currentVideos, loading, refreshing, onRefresh: tabsRefresh, loadMore, hasMore, gridVideos } = tabsHook
  const [profileErrors, setProfileErrors] = useState<{ stories?: string }>({})
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [storiesCheckDone, setStoriesCheckDone] = useState(false)
  const [highlightsLoaded, setHighlightsLoaded] = useState(false)
  const [ready, setReady] = useState(false)

  const [menuVisible, setMenuVisible] = useState(false)
  const [shareVisible, setShareVisible] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false)
  const [highlights, setHighlights] = useState<any[]>([])
  const [viewerHighlight, setViewerHighlight] = useState<any | null>(null)
  const [viewerMediaIdx, setViewerMediaIdx] = useState(0)
  const [viewerOptionsVisible, setViewerOptionsVisible] = useState(false)
  const [mediaLoading, setMediaLoading] = useState(false)
  const [hasStory, setHasStory] = useState(false)
  const [statsModal, setStatsModal] = useState(false)
  const [followersModal, setFollowersModal] = useState(false)
  const [followListType, setFollowListType] = useState<'followers' | 'following'>('followers')
  const [followListUsers, setFollowListUsers] = useState<any[]>([])
  const [followListLoading, setFollowListLoading] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const menuAnim = useState(new Animated.Value(0))[0]
  const shareAnim = useState(new Animated.Value(0))[0]
  const [page, setPage] = useState(0)
  const [scrollOffsetX, setScrollOffsetX] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const [tabLayouts, setTabLayouts] = useState<{ x: number; width: number }[]>([
    { x: 0, width: 0 }, { x: 0, width: 0 },
  ])
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
  const [editingHighlight, setEditingHighlight] = useState<any | undefined>(undefined)
  const editSheetVisible = editingHighlight !== undefined
  const [pendingRequestsLoading, setPendingRequestsLoading] = useState(false)
  const [pendingRequestsUsers, setPendingRequestsUsers] = useState<any[]>([])
  const [showRequestsTab, setShowRequestsTab] = useState(false)
  const setStringAsync = () => Promise.resolve()

  const loadProfile = useCallback(async () => {
    if (!user) { setProfileLoaded(true); return }
    try {
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (snap.exists()) {
        setProfile(snap.data() as UserType)
      }
    } catch { captureException(new Error('loadProfile')) }
    setProfileLoaded(true)
  }, [user])

  const detectCity = useCallback(async (): Promise<string | null> => {
    if (!user) return null
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return null
    try {
      const loc = await Location.getCurrentPositionAsync({})
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
      if (geo.length > 0) {
        const g = geo[0]
        return g.city || g.subregion || g.district || g.region || g.country || null
      }
    } catch {}
    return null
  }, [user])

  const checkStories = useCallback(async () => {
    if (!user) { setStoriesCheckDone(true); return }
    try {
      const q = query(collection(db, 'stories'), where('userId', '==', user.uid), where('expiresAt', '>', new Date()), limit(1))
      const result = await withFirestoreRetry(
        () => getDocs(q),
        { context: 'profile/checkStories' },
      )
      if (result.error) {
        setProfileErrors((prev) => ({ ...prev, stories: getIndexErrorMessage(result.error!.code) }))
        setHasStory(false)
        setStoriesCheckDone(true)
        return
      }
      setProfileErrors((prev) => ({ ...prev, stories: undefined }))
      if (result.data) setHasStory(!(result.data as any).empty)
      else setHasStory(false)
    } catch { setHasStory(false) }
    setStoriesCheckDone(true)
  }, [user])

  const loadHighlights = useCallback(async () => {
    if (!user) { setHighlightsLoaded(true); return }
    try {
      const q = query(collection(db, 'highlights'), where('userId', '==', user.uid))
      const snap = await getDocs(q)
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as any[]
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setHighlights(items)
    } catch { setHighlights([]) }
    setHighlightsLoaded(true)
  }, [user])

  useEffect(() => { loadProfile() }, [loadProfile])
  useEffect(() => {
    if (profileLoaded && !loading && storiesCheckDone && highlightsLoaded) setReady(true)
  }, [profileLoaded, loading, storiesCheckDone, highlightsLoaded])
  useEffect(() => { checkStories() }, [checkStories])
  useEffect(() => { loadHighlights() }, [loadHighlights])
  useFocusEffect(useCallback(() => { loadHighlights() }, [loadHighlights]))
  useFocusEffect(useCallback(() => { loadProfile(); checkStories() }, [loadProfile, checkStories]))

  const onRefresh = useCallback(async () => {
    await Promise.all([tabsRefresh(), loadProfile(), checkStories(), loadHighlights()])
  }, [tabsRefresh, loadProfile, checkStories, loadHighlights])

  const handleThumbnailPress = useCallback((videoId: string) => {
    const idx = currentVideos.findIndex(v => v.id === videoId)
    if (idx !== -1) setViewerIndex(idx)
  }, [currentVideos])

  const openMenu = () => { setMenuVisible(true); Animated.timing(menuAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start() }
  const closeMenu = () => { Animated.timing(menuAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMenuVisible(false)) }
  const shareProfile = () => { setShareVisible(true); Animated.timing(shareAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start() }
  const closeShare = () => { Animated.timing(shareAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShareVisible(false)) }

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Tu veux vraiment te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Oui', style: 'destructive', onPress: async () => {
        await signOut(auth)
        await AsyncStorage.removeItem('@mbolo_session_cache')
        useStartupStore.getState().setUser(null)
        router.replace('/(auth)/login')
      }},
    ])
  }



  const openNewHighlight = () => { setEditingHighlight(null) }
  const openEditHighlight = (hl: any) => { setEditingHighlight(hl) }
  const uploadMediaToCloudinary = async (uri: string): Promise<string | null> => {
    try {
      return await uploadToCloudinary(uri, undefined, { folder: 'highlights', timeout: 120000 })
    } catch { return null }
  }
  const deleteHighlight = async (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cette mise en avant ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { try { await deleteDoc(doc(db, 'highlights', id)); await loadHighlights() } catch {} } },
    ])
  }

  const closeViewer = () => {
    setViewerHighlight(null)
  }
  const openHighlight = (hl: any) => { setViewerHighlight(hl) }
  const closeEditSheet = () => { setEditingHighlight(undefined) }
  const onHighlightSaved = () => { loadHighlights() }
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  const openFollowList = async (initialType: 'followers' | 'following' | 'requests') => {
    if (!profile) return
    const targetPage = initialType === 'followers' ? 0 : initialType === 'requests' ? 2 : 1
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
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'openFollowList-fetchUsers' }) }
    setFollowListLoading(false)
    setPendingRequestsLoading(true)
    try {
      const pendingIds = profile.pendingFollowers || []
      const pendingMap = await batchFetchUsers(pendingIds.slice(0, 50))
      setPendingRequestsUsers(Array.from(pendingMap.values()))
    } catch (e) { captureException(e instanceof Error ? e : new Error(String(e)), { context: 'openFollowList-fetchPending' }) }
    setPendingRequestsLoading(false)
    setShowRequestsTab((profile.pendingFollowers || []).length > 0)
  }

  const closeFollowModal = useCallback(() => setFollowersModal(false), [])

  useEffect(() => {
    if (followersModal) {
      setTimeout(() => { scrollRef.current?.scrollTo({ x: page * SCREEN_WIDTH, animated: false }) }, 0)
    }
  }, [followersModal, page])

  const tabConfig: ProfileTab[] = ['grid', 'reels', 'saved', 'liked', 'reposted', 'tagged']

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

  if (!ready) {
    return (
      <PageWrapper type="fadeSlide" style={{ backgroundColor: colors.black }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.black, justifyContent: 'center', alignItems: 'center' }}>
          <OrbitLoader size={80} />
        </SafeAreaView>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper type="fadeSlide" style={{ backgroundColor: colors.black }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.black }}>
      <GestureDetector gesture={swipeGesture}>
        <VideoGrid
          videos={currentVideos}
          tab={activeTab}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          loadMore={loadMore}
          hasMore={hasMore}
          isOwn
          onThumbnailPress={handleThumbnailPress}
          ListHeaderComponent={
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
                <TouchableOpacity onPress={openCreateModal} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary }}>
                  <Ionicons name="add" size={24} color={colors.white} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>{profile?.pseudo || user?.displayName || ''}</Text>
                    {profile?.verified && <VerifiedBadge />}
                  </View>
                </View>
                <TouchableOpacity onPress={openMenu} style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-end' }}>
                  <Ionicons name="menu-outline" size={28} color={colors.white} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 }}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => profile?.photoURL && setPhotoViewerVisible(true)} style={{ width: 90, height: 90, borderRadius: 45, borderWidth: hasStory ? 3 : 0, borderColor: hasStory ? colors.secondary : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                  {profile?.photoURL ? <Image source={{ uri: profile.photoURL }} style={{ width: 84, height: 84, borderRadius: 42 }} /> : <Ionicons name="person" size={40} color="#555" />}
                </TouchableOpacity>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
                  <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setActiveTab('grid')}>
                    <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{gridVideos.length}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Vidéos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => openFollowList('followers')}>
                    <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{profile?.followerCount ?? profile?.followers?.length ?? 0}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Abonnés</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => openFollowList('following')}>
                    <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{profile?.followingCount ?? profile?.following?.length ?? 0}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Abonnements</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.white, fontSize: 14, fontWeight: '700' }}>{profile?.nom || ''}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 1 }}>@{profile?.pseudo || user?.displayName || ''}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {profile?.city ? (
                      <TouchableOpacity onPress={async () => { const cityName = await detectCity(); if (cityName) { await updateDoc(doc(db, 'users', user!.uid), { city: cityName }); setProfile(prev => prev ? { ...prev, city: cityName } : prev) } }} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{profile.city}</Text>
                        <Ionicons name="refresh-outline" size={12} color={colors.textFaint} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={async () => { const cityName = await detectCity(); if (cityName) { await updateDoc(doc(db, 'users', user!.uid), { city: cityName }); setProfile(prev => prev ? { ...prev, city: cityName } : prev) } }} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="location-outline" size={13} color={colors.textFaint} />
                        <Text style={{ color: colors.textFaint, fontSize: 12 }}>Détection...</Text>
                      </TouchableOpacity>
                    )}
                    {(() => { const age = calcAge(profile?.dateOfBirth || ''); return age && profile?.showAge !== false ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="calendar-outline" size={13} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontSize: 12 }}>{age} ans</Text></View> : null })()}
                  </View>
                  {profile?.bio ? <RichText text={profile.bio} style={{ color: colors.white, fontSize: 13, marginTop: 4, lineHeight: 18 }} /> : null}
                  {(profile as any)?.externalLink ? (
                    <TouchableOpacity onPress={async () => { try { await require('expo-linking').openURLAsync((profile as any).externalLink) } catch {} }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Ionicons name="link-outline" size={13} color={colors.secondary} />
                      <Text style={{ color: colors.secondary, fontSize: 12 }}>{(profile as any).externalLink}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {profile?.pendingFollowers?.length ? (
                    <TouchableOpacity onPress={() => openFollowList('requests')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                      <Ionicons name="person-add-outline" size={14} color={colors.secondary} />
                      <Text style={{ color: colors.secondary, fontSize: 13, fontWeight: '600' }}>
                        {profile!.pendingFollowers!.length} demande{profile!.pendingFollowers!.length > 1 ? 's' : ''} en attente
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'column', gap: 8, justifyContent: 'center', marginLeft: 12 }}>
                  <TouchableOpacity onPress={() => router.push('/insights')} style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="bar-chart-outline" size={18} color={colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/edit-profile')} style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="pencil-outline" size={18} color={colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={shareProfile} style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
                    <Ionicons name="share-outline" size={18} color={colors.white} />
                  </TouchableOpacity>
                </View>
              </View>

              <HighlightRow
                highlights={highlights}
                onAdd={openNewHighlight}
                onPress={openHighlight}
                onEdit={openEditHighlight}
                onDelete={(hl) => deleteHighlight(hl.id)}
              />

              {Object.values(profileErrors).some(Boolean) && (
                <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 6 }}>
                  {profileErrors.stories && <QueryErrorMessage message={profileErrors.stories} />}
                </View>
              )}

              <ProfileTabBar tabs={tabConfig} activeTab={activeTab} onTabChange={handleTabChange} swipeOffsetPx={swipeOffsetPx} />
            </View>
          }
          />
      </GestureDetector>
    </SafeAreaView>

    {/* MENU */}
    <Modal transparent visible={menuVisible} animationType="slide" onRequestClose={closeMenu}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={closeMenu} style={{ flex: 1, backgroundColor: colors.overlay }} />
        <Animated.View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34, transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }}>
          <View style={{ paddingVertical: 12, alignItems: 'center' }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} /></View>
          {[
            { icon: 'settings-outline', label: 'Paramètres', action: () => { closeMenu(); router.push('/settings') } },
            { icon: 'shield-checkmark-outline', label: 'Confidentialité', action: () => { closeMenu(); router.push('/settings') } },
            { icon: 'time-outline', label: 'Activité', action: () => { closeMenu(); router.push('/settings') } },
            { icon: 'bookmark-outline', label: 'Vidéos sauvegardées', action: () => { closeMenu(); setActiveTab('saved') } },
            { icon: 'heart-outline', label: 'Vidéos aimées', action: () => { closeMenu(); setActiveTab('liked') } },
            { icon: 'notifications-outline', label: 'Notifications', action: () => closeMenu() },
            { icon: 'help-circle-outline', label: 'Aide', action: () => closeMenu() },
            { icon: 'information-circle-outline', label: 'À propos de Mbolo', action: () => closeMenu() },
          ].map((item, i) => (
            <TouchableOpacity key={i} onPress={item.action} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 }}>
              <Ionicons name={item.icon as any} size={22} color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 15 }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
          <TouchableOpacity onPress={() => { closeMenu(); handleLogout() }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 }}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: 15, fontWeight: '600' }}>Se déconnecter</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>

    {/* SHARE */}
    <Modal transparent visible={shareVisible} animationType="slide" onRequestClose={closeShare}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={closeShare} style={{ flex: 1, backgroundColor: colors.overlay }} />
        <Animated.View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34, transform: [{ translateY: shareAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }}>
          <View style={{ paddingVertical: 12, alignItems: 'center' }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} /></View>
          <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>Partager le profil</Text>
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="link-outline" size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, color: colors.textOnMedia, fontSize: 14 }} numberOfLines={1}>https://mbolo.app/@{profile?.pseudo || ''}</Text>
              <TouchableOpacity onPress={async () => { try { await require('expo-clipboard').setStringAsync(`https://mbolo.app/@${profile?.pseudo || ''}`); Alert.alert('Lien copié', 'Le lien a été copié dans le presse-papiers') } catch {} }} style={{ marginLeft: 8, padding: 4 }}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Copier</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={() => { setShareVisible(false); shareAnim.setValue(0); setTimeout(() => setShowQR(true), 100) }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.surfaceLight, borderRadius: 12 }}>
            <Ionicons name="qr-code-outline" size={20} color={colors.white} />
            <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>Code QR</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { try { await Share.share({ message: `Découvre @${profile?.pseudo || ''} sur Mbolo ! 🇬🇦\nhttps://mbolo.app/@${profile?.pseudo || ''}` }) } catch {} }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, marginHorizontal: 16, backgroundColor: colors.surfaceLight, borderRadius: 12 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.white} />
            <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>Plus d'options</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>

    {/* QR CODE MODAL */}
    <Modal visible={showQR} transparent animationType="slide" onRequestClose={() => setShowQR(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => setShowQR(false)} style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 }}>
          <Ionicons name="close" size={30} color={colors.white} />
        </TouchableOpacity>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', width: '80%' }}>
          <QRCodeView
            data={`https://mbolo.app/@${profile?.pseudo || ''}`}
            size={200}
            foreground={colors.black}
            background={colors.white}
          />
          <Text style={{ color: colors.black, fontSize: 18, fontWeight: '700', marginTop: 16 }}>@{profile?.pseudo || ''}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' }}>Scanne pour voir mon profil Mbolo 🇬🇦</Text>
          <TouchableOpacity
            onPress={async () => {
              try {
                const clip = require('expo-clipboard')
                await clip.setStringAsync(`https://mbolo.app/@${profile?.pseudo || ''}`)
                Alert.alert('Lien copié', 'Le lien du profil a été copié')
              } catch {}
            }}
            style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}
          >
            <Text style={{ color: colors.white, fontSize: 14, fontWeight: '600' }}>Copier le lien du profil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    {/* PHOTO VIEWER */}
    <AvatarViewer
      uri={profile?.photoURL || ''}
      visible={photoViewerVisible}
      onClose={() => setPhotoViewerVisible(false)}
    />

    <HighlightViewer
    highlight={viewerHighlight}
    visible={viewerHighlight !== null}
    onClose={closeViewer}
    onDelete={(id) => deleteHighlight(id)}
              onEdit={(hl) => {
                closeViewer()
                setTimeout(() => setEditingHighlight(hl), 400)
              }}
    onAddMedia={async (highlightId, currentMediaUrls) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    animRef.current?.stop()
    try {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 0.8, selectionLimit: 10 })
    if (!result.canceled && result.assets.length > 0) {
    const urls: string[] = []
    for (const asset of result.assets) {
    const url = await uploadMediaToCloudinary(asset.uri)
    if (url) urls.push(url)
    }
    if (urls.length > 0) {
    const snap = await getDoc(doc(db, 'highlights', highlightId))
    const latest = snap.data()
    const existing = latest?.mediaUrls || currentMediaUrls
    const allUrls = [...existing, ...urls]
    await updateDoc(doc(db, 'highlights', highlightId), { mediaUrls: allUrls, coverUrl: allUrls[0] })
    setViewerHighlight((prev: any) => prev ? { ...prev, mediaUrls: allUrls } : prev)
    return urls
    }
    }
    } catch (e) { console.error('Ajouter média error:', e) }
    return []
    }}
    profileAvatar={profile?.photoURL}
    profilePseudo={profile?.pseudo}
    />

    <HighlightEditSheet
      visible={editSheetVisible}
      onClose={closeEditSheet}
      onSaved={onHighlightSaved}
      highlight={editingHighlight}
    />

    {/* FOLLOWERS/FOLLOWING MODAL */}
    <BottomSheet visible={followersModal} onClose={closeFollowModal} height={SCREEN_HEIGHT * 0.85}>
      {/* Tab bar */}
      <View style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24 }}>
          <TouchableOpacity onLayout={(e) => { const { x, width } = e.nativeEvent.layout; setTabLayouts(prev => { const n = [...prev]; n[0] = { x, width }; return n }) }} onPress={() => { setPage(0); scrollRef.current?.scrollTo({ x: 0, animated: true }) }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: page === 0 ? colors.white : colors.textSecondary }}>Abonnés</Text>
          </TouchableOpacity>
          <TouchableOpacity onLayout={(e) => { const { x, width } = e.nativeEvent.layout; setTabLayouts(prev => { const n = [...prev]; n[1] = { x, width }; return n }) }} onPress={() => { setPage(1); scrollRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: true }) }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: page === 1 ? colors.white : colors.textSecondary }}>Abonnements</Text>
          </TouchableOpacity>
                {showRequestsTab && (
                  <TouchableOpacity onLayout={(e) => { const { x, width } = e.nativeEvent.layout; setTabLayouts(prev => { const n = [...prev]; n[2] = { x, width }; return n }) }} onPress={() => { setPage(2); scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * 2, animated: true }) }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: page === 2 ? colors.white : colors.textSecondary }}>Demandes</Text>
                  </TouchableOpacity>
                )}
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
                        <Ionicons name="people-outline" size={48} color={colors.border} />
                        <Text style={{ color: colors.textFaint, fontSize: 14, marginTop: 12 }}>Aucun abonné</Text>
                      </View>
                    )
                  }
                  renderItem={({ item }) => {
                    const isMe = item.id === user?.uid
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
                          <Text style={{ color: colors.textSecondary, fontSize: 13, height: 18, lineHeight: 18 }}>@{item.pseudo || ''}</Text>
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
                        <Ionicons name="people-outline" size={48} color={colors.border} />
                        <Text style={{ color: colors.textFaint, fontSize: 14, marginTop: 12 }}>Aucun abonnement</Text>
                      </View>
                    )
                  }
                  renderItem={({ item }) => {
                    const isMe = item.id === user?.uid
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
                          <Text style={{ color: colors.textSecondary, fontSize: 13, height: 18, lineHeight: 18 }}>@{item.pseudo || ''}</Text>
                        </View>
                        {!isMe && <FollowButton targetUserId={item.id} size="sm" />}
                      </TouchableOpacity>
                    )
                  }}
                />
              </View>
              {/* Demandes */}
              <View key="requests" style={{ width: SCREEN_WIDTH, flex: 1 }}>
                <FlatList
                  data={pendingRequestsLoading ? [] : pendingRequestsUsers}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ padding: 16 }}
                  ListEmptyComponent={
                    pendingRequestsLoading ? (
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
                        <OrbitLoader size={80} />
                      </View>
                    ) : (
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
                        <Ionicons name="people-outline" size={48} color={colors.border} />
                        <Text style={{ color: colors.textFaint, fontSize: 14, marginTop: 12 }}>Aucune demande</Text>
                      </View>
                    )
                  }
                  renderItem={({ item }) => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
                      <Avatar uri={item.photoURL} name={item.nom || item.pseudo} size={44} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600', height: 20, lineHeight: 20 }}>{item.nom || ''}</Text>
                          {item.verified && <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />}
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, height: 18, lineHeight: 18 }}>@{item.pseudo || ''}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={async () => {
                          await acceptFollowRequest(item.id)
                          setPendingRequestsUsers((prev) => prev.filter((u) => u.id !== item.id))
                        }}
                        style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 }}
                      >
                        <Text style={{ color: colors.white, fontSize: 13, fontWeight: '700' }}>Accepter</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => {
                          await rejectFollowRequest(item.id)
                          setPendingRequestsUsers((prev) => prev.filter((u) => u.id !== item.id))
                        }}
                        style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                      >
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Refuser</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              </View>
            </ScrollView>
    </BottomSheet>
      {viewerIndex !== null && (
        <ProfileVideoViewer
          videos={currentVideos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          userId={user?.uid || ''}
          isOwn
          profileUser={{ nom: profile?.nom, photoURL: profile?.photoURL }}
        />
      )}
    </PageWrapper>
  )
}
