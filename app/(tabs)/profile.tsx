import { useState, useEffect, useCallback, useRef } from 'react'
import { router, useFocusEffect, useRouter } from 'expo-router'
import {
  View, Text, TouchableOpacity, Image, FlatList, Alert, TextInput,
  Dimensions, RefreshControl, ScrollView, Modal, Animated, Share,
  ActivityIndicator, Easing,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import {
  doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc, deleteDoc, setDoc,
  arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { Video as AVVideo } from 'expo-av'
import { auth, db } from '../../src/lib/firebase'
import { uploadToCloudinary } from '../../src/lib/cloudinary'
import { colors } from '../../src/lib/theme'
import QRCodeView from '../../src/components/QRCodeView'
import type { User as UserType, Video as VideoType } from '../../src/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_COLS = 3
const ITEM_SIZE = SCREEN_WIDTH / GRID_COLS

const DEMO_VIDEOS: VideoType[] = [
  { id: 'demo-1', userId: 'demo', videoURL: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', description: 'Bienvenue sur Mbolo ! 🇬🇦', hashtags: ['Gabon', 'Mbolo'], likes: 42, comments: 7, shares: 3, saves: 0, createdAt: null as any },
  { id: 'demo-2', userId: 'demo', videoURL: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', description: 'Le Gabon est magnifique ✨', hashtags: ['Gabon', 'Nature'], likes: 88, comments: 12, shares: 5, saves: 0, createdAt: null as any },
  { id: 'demo-3', userId: 'demo', videoURL: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', description: 'Danse traditionnelle 🎵', hashtags: ['Culture', 'Danse'], likes: 156, comments: 23, shares: 15, saves: 0, createdAt: null as any },
]

type Tab = 'grid' | 'reels' | 'saved' | 'liked'

function VideoThumbnailCell({ item, isOwn }: { item: VideoType; isOwn?: boolean }) {
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

  const handleLongPress = () => {
    if (!isOwn) return
    Alert.alert(
      'Options vidéo',
      item.description || 'Aucune description',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Modifier description',
          onPress: async () => {
            const newDesc = prompt('Nouvelle description :', item.description)
            if (newDesc !== null) {
              try {
                await updateDoc(doc(db, 'videos', item.id), { description: newDesc })
              } catch {}
            }
          },
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'videos', item.id))
            } catch {}
          },
        },
      ]
    )
  }

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => router.push({ pathname: '/(tabs)/feed', params: { videoId: item.id } })} onLongPress={handleLongPress} delayLongPress={500} style={{ width: ITEM_SIZE, height: ITEM_SIZE }}>
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

export default function Profile() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserType | null>(null)
  const [videos, setVideos] = useState<VideoType[]>([])
  const [savedVideos, setSavedVideos] = useState<VideoType[]>([])
  const [likedVideos, setLikedVideos] = useState<VideoType[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('grid')
  const [refreshing, setRefreshing] = useState(false)
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
  const menuAnim = useState(new Animated.Value(0))[0]
  const shareAnim = useState(new Animated.Value(0))[0]
  const progressAnim = useState(new Animated.Value(0))[0]
  const mediaOpacity = useState(new Animated.Value(0))[0]
  const mediaTranslateX = useState(new Animated.Value(0))[0]
  const prevHighlightId = useRef<string | null>(null)
  const viewerTranslateY = useState(new Animated.Value(0))[0]
  const viewerOpacity = useState(new Animated.Value(1))[0]
  const touchStartY = useRef(0)
  const handlePressIn = (e: any) => { clearTimeout(timerRef.current); animRef.current?.stop(); touchStartY.current = e?.nativeEvent?.pageY || 0 }
  const handlePressOut = (e: any) => {
    const dy = (e?.nativeEvent?.pageY || 0) - touchStartY.current
    if (dy > 120) {
      Animated.parallel([
        Animated.timing(viewerTranslateY, { toValue: Dimensions.get('window').height, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(viewerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        setViewerHighlight(null)
        setViewerMediaIdx(0)
      })
      return
    }
    if (dy > 10) {
      Animated.parallel([
        Animated.spring(viewerTranslateY, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
        Animated.spring(viewerOpacity, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      ]).start()
    }
    if (viewerHighlight === null || viewerOptionsVisible) return
    progressAnim.stopAnimation((val) => {
      const remaining = (1 - val) * 5000
      if (remaining <= 100) {
        const media = viewerHighlight.mediaUrls || [viewerHighlight.coverUrl]
        if (viewerMediaIdx < media.length - 1) {
          progressAnim.setValue(0)
          setViewerMediaIdx(prev => prev + 1)
        } else { closeViewer() }
        return
      }
      animRef.current = Animated.timing(progressAnim, { toValue: 1, duration: remaining, easing: Easing.linear, useNativeDriver: false })
      animRef.current.start()
      timerRef.current = setTimeout(() => {
        const media = viewerHighlight.mediaUrls || [viewerHighlight.coverUrl]
        if (viewerMediaIdx < media.length - 1) setViewerMediaIdx(prev => prev + 1)
        else { closeViewer() }
      }, remaining)
    })
  }
  const viewerOptionsAnim = useState(new Animated.Value(0))[0]
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const animRef = useRef<Animated.CompositeAnimation>()
  const progressTimerStarted = useRef(false)
  const user = auth.currentUser

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

  const loadProfile = useCallback(async () => {
    if (!user) return
    try {
      const snap = await getDoc(doc(db, 'users', user.uid))
      if (snap.exists()) {
        const data = snap.data() as UserType
        if (!data.city) {
          const cityName = await detectCity()
          if (cityName) {
            await updateDoc(doc(db, 'users', user.uid), { city: cityName })
            data.city = cityName
          }
        }
        setProfile(data)
      }
    } catch {}
  }, [user, detectCity])

  const loadVideos = useCallback(async () => {
    if (!user) return
    try {
      const q = query(collection(db, 'videos'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(50))
      const snap = await getDocs(q)
      setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as VideoType[])
    } catch { setVideos([]) }
  }, [user])

  const totalLikes = videos.reduce((sum, v) => sum + (v.likes || 0), 0)
  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0)
  const totalShares = videos.reduce((sum, v) => sum + (v.shares || 0), 0)

  const loadSaved = useCallback(async () => {
    if (!user) return
    try {
      const q = query(collection(db, 'videos'), where('savedBy', 'array-contains', user.uid), orderBy('createdAt', 'desc'), limit(50))
      const snap = await getDocs(q)
      setSavedVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as VideoType[])
    } catch { setSavedVideos([]) }
  }, [user])

  const loadLiked = useCallback(async () => {
    if (!user) return
    try {
      const q = query(collection(db, 'videos'), where('likedBy', 'array-contains', user.uid), orderBy('createdAt', 'desc'), limit(50))
      const snap = await getDocs(q)
      setLikedVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as VideoType[])
    } catch { setLikedVideos([]) }
  }, [user])

  const checkStories = useCallback(async () => {
    if (!user) return
    try {
      const q = query(collection(db, 'stories'), where('userId', '==', user.uid), where('expiresAt', '>', new Date()), limit(1))
      const snap = await getDocs(q)
      setHasStory(!snap.empty)
    } catch { setHasStory(false) }
  }, [user])

  const loadHighlights = useCallback(async () => {
    if (!user) return
    try {
      const q = query(collection(db, 'highlights'), where('userId', '==', user.uid))
      const snap = await getDocs(q)
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setHighlights(items)
    } catch { setHighlights([]) }
  }, [user])

  useEffect(() => { loadProfile() }, [loadProfile])
  useEffect(() => { loadVideos() }, [loadVideos])
  useEffect(() => { loadSaved() }, [loadSaved])
  useEffect(() => { loadLiked() }, [loadLiked])
  useEffect(() => { checkStories() }, [checkStories])
  useEffect(() => { loadHighlights() }, [loadHighlights])
  useFocusEffect(useCallback(() => { loadHighlights() }, [loadHighlights]))
  useFocusEffect(useCallback(() => { loadProfile(); checkStories() }, [loadProfile, checkStories]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([loadProfile(), loadVideos(), loadSaved(), loadLiked(), checkStories(), loadHighlights()])
    setRefreshing(false)
  }, [loadProfile, loadVideos, loadSaved, loadLiked, checkStories, loadHighlights])

  const openMenu = () => { setMenuVisible(true); Animated.timing(menuAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start() }
  const closeMenu = () => { Animated.timing(menuAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMenuVisible(false)) }
  const shareProfile = () => { setShareVisible(true); Animated.timing(shareAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start() }
  const closeShare = () => { Animated.timing(shareAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShareVisible(false)) }

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Tu veux vraiment te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Oui', style: 'destructive', onPress: async () => { await signOut(auth); router.replace('/(auth)/login') } },
    ])
  }

  const currentVideos = activeTab === 'grid'
    ? (videos.filter(v => v.type !== 'reel').length > 0 ? videos.filter(v => v.type !== 'reel') : DEMO_VIDEOS)
    : activeTab === 'reels'
      ? videos.filter(v => v.type === 'reel')
      : activeTab === 'saved'
        ? savedVideos
        : activeTab === 'liked'
          ? likedVideos
          : []

  const renderGridItem = ({ item }: { item: VideoType }) => <VideoThumbnailCell item={item} isOwn />

  const openNewHighlight = () => { router.push('/highlight/new') }
  const openEditHighlight = (hl: any) => { router.push(`/highlight/${hl.id}`) }
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
  const getOptimizedUrl = (url: string) => {
    if (!url || url.includes('.mp4') || url.includes('.mov')) return url
    return url.replace('/upload/', '/upload/w_600,h_1000,c_fill,q_auto,f_auto/')
  }

  const closeViewer = () => {
    setViewerHighlight(null)
    setViewerMediaIdx(0)
  }
  const openHighlight = (hl: any) => { viewerTranslateY.setValue(0); viewerOpacity.setValue(1); setViewerHighlight(hl); setViewerMediaIdx(0); setViewerOptionsVisible(false) }

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
    if (!user || !targetId) return
    const userRef = doc(db, 'users', user.uid)
    const targetRef = doc(db, 'users', targetId)
    const isCurrentlyFollowing = profile?.followers?.includes(targetId) ?? false
    if (isCurrentlyFollowing) {
      try {
        await Promise.all([
          updateDoc(userRef, { following: arrayRemove(targetId) }),
          updateDoc(targetRef, { followers: arrayRemove(user.uid) }),
        ])
        setProfile(prev => prev ? { ...prev, followers: (prev.followers || []).filter(id => id !== targetId) } : prev)
      } catch {}
    } else {
      try {
        await Promise.all([
          updateDoc(userRef, { following: arrayUnion(targetId) }),
          updateDoc(targetRef, { followers: arrayUnion(user.uid) }),
        ])
        setProfile(prev => prev ? { ...prev, followers: [...(prev.followers || []), targetId] } : prev)
      } catch {}
    }
    await loadProfile()
    setFollowListUsers(prev => prev.map(u => {
      if (u.id === targetId) {
        const followers = u.followers || []
        return { ...u, followers: isCurrentlyFollowing ? followers.filter((id: string) => id !== user.uid) : [...followers, user.uid] }
      }
      return u
    }))
  }

  useEffect(() => {
    if (viewerHighlight === null) {
      prevHighlightId.current = null
      clearTimeout(timerRef.current)
      animRef.current?.stop()
      return
    }
    if (viewerOptionsVisible) {
      clearTimeout(timerRef.current)
      animRef.current?.stop()
      return
    }
    setMediaLoading(true)
    animRef.current?.stop()
    clearTimeout(timerRef.current)
    progressTimerStarted.current = false
    progressAnim.setValue(0)
    const isNewHighlight = prevHighlightId.current !== viewerHighlight.id
    prevHighlightId.current = viewerHighlight.id
    if (isNewHighlight) {
      mediaOpacity.setValue(0)
      mediaTranslateX.setValue(0)
      Animated.timing(mediaOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => startProgressTimer())
    } else {
      mediaTranslateX.setValue(Dimensions.get('window').width)
      mediaOpacity.setValue(1)
      Animated.spring(mediaTranslateX, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start(() => startProgressTimer())
    }
    const media = viewerHighlight.mediaUrls || [viewerHighlight.coverUrl]
    media.forEach((url: string) => { if (url && !url.includes('.mp4') && !url.includes('.mov')) Image.prefetch(getOptimizedUrl(url)) })
    return () => { clearTimeout(timerRef.current); animRef.current?.stop() }
  }, [viewerHighlight, viewerMediaIdx, viewerOptionsVisible])

  const startProgressTimer = () => {
    if (viewerHighlight === null || viewerOptionsVisible || progressTimerStarted.current) return
    progressTimerStarted.current = true
    progressAnim.setValue(0)
    animRef.current = Animated.timing(progressAnim, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: false })
    animRef.current.start()
    timerRef.current = setTimeout(() => {
      progressTimerStarted.current = false
      const media = viewerHighlight.mediaUrls || [viewerHighlight.coverUrl]
      if (viewerMediaIdx < media.length - 1) {
        progressAnim.setValue(0)
        setViewerMediaIdx(prev => prev + 1)
      } else { closeViewer() }
    }, 5000)
  }

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: 'grid', icon: 'grid-outline', label: 'Vidéos' },
    { key: 'reels', icon: 'film-outline', label: 'Reels' },
  ]
  tabs.push({ key: 'saved', icon: 'bookmark-outline', label: 'Sauvés' })
  tabs.push({ key: 'liked', icon: 'heart-outline', label: 'Aimés' })

  return (
    <>
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        data={currentVideos}
        numColumns={GRID_COLS}
        keyExtractor={(item) => item.id}
        renderItem={renderGridItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
              <TouchableOpacity onPress={() => router.push('/(tabs)/camera')} style={{ width: 36, height: 36, justifyContent: 'center' }}>
                <Ionicons name="add-circle" size={28} color={colors.primary} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>{profile?.pseudo || user?.displayName || 'Utilisateur'}</Text>
                  {profile?.verified && <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />}
                </View>
              </View>
              <TouchableOpacity onPress={openMenu} style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'flex-end' }}>
                <Ionicons name="menu-outline" size={28} color={colors.white} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 }}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => profile?.photoURL && setPhotoViewerVisible(true)} style={{ width: 90, height: 90, borderRadius: 45, borderWidth: hasStory ? 3 : 0, borderColor: hasStory ? '#3A75C4' : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                {profile?.photoURL ? <Image source={{ uri: profile.photoURL }} style={{ width: 84, height: 84, borderRadius: 42 }} /> : <Ionicons name="person" size={40} color="#555" />}
              </TouchableOpacity>
              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => setActiveTab('grid')}>
                  <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{videos.length}</Text>
                  <Text style={{ color: '#888', fontSize: 12 }}>Vidéos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => openFollowList('followers')}>
                  <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{profile?.followers?.length || 0}</Text>
                  <Text style={{ color: '#888', fontSize: 12 }}>Abonnés</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => openFollowList('following')}>
                  <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{profile?.following?.length || 0}</Text>
                  <Text style={{ color: '#888', fontSize: 12 }}>Abonnements</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.white, fontSize: 14, fontWeight: '700' }}>{profile?.nom || ''}</Text>
                <Text style={{ color: '#888', fontSize: 13, marginTop: 1 }}>@{profile?.pseudo || user?.displayName || 'utilisateur'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {profile?.city ? (
                    <TouchableOpacity onPress={async () => { const cityName = await detectCity(); if (cityName) { await updateDoc(doc(db, 'users', user!.uid), { city: cityName }); setProfile(prev => prev ? { ...prev, city: cityName } : prev) } }} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="location-outline" size={13} color="#888" />
                      <Text style={{ color: '#888', fontSize: 12 }}>{profile.city}</Text>
                      <Ionicons name="refresh-outline" size={12} color="#555" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={async () => { const cityName = await detectCity(); if (cityName) { await updateDoc(doc(db, 'users', user!.uid), { city: cityName }); setProfile(prev => prev ? { ...prev, city: cityName } : prev) } }} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="location-outline" size={13} color="#555" />
                      <Text style={{ color: '#555', fontSize: 12 }}>Détection...</Text>
                    </TouchableOpacity>
                  )}
                  {(() => { const age = calcAge(profile?.dateOfBirth || ''); return age && profile?.showAge !== false ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Ionicons name="calendar-outline" size={13} color="#888" /><Text style={{ color: '#888', fontSize: 12 }}>{age} ans</Text></View> : null })()}
                </View>
                {profile?.bio ? <Text style={{ color: colors.white, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{profile.bio}</Text> : null}
                {(profile as any)?.externalLink ? (
                  <TouchableOpacity onPress={async () => { try { await require('expo-linking').openURLAsync((profile as any).externalLink) } catch {} }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Ionicons name="link-outline" size={13} color={colors.secondary} />
                    <Text style={{ color: colors.secondary, fontSize: 12 }}>{(profile as any).externalLink}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => setStatsModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: '#111', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#222', alignSelf: 'flex-start' }}>
                  <Ionicons name="stats-chart-outline" size={14} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>Statistiques</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'column', gap: 8, justifyContent: 'center', marginLeft: 12 }}>
                <TouchableOpacity onPress={() => router.push('/(tabs)/edit-profile')} style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#222', borderWidth: 1, borderColor: '#444', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="pencil-outline" size={18} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity onPress={shareProfile} style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#222', borderWidth: 1, borderColor: '#444', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="share-outline" size={18} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 16, paddingLeft: 16 }} contentContainerStyle={{ gap: 14 }}>
              <TouchableOpacity onPress={openNewHighlight} style={{ alignItems: 'center' }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: '#444', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="add" size={28} color="#888" />
                </View>
                <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>Nouveau</Text>
              </TouchableOpacity>
              {highlights.map((hl) => (
                <TouchableOpacity key={hl.id} onPress={() => openHighlight(hl)} onLongPress={() => Alert.alert(hl.title, 'Que veux-tu faire ?', [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Modifier', onPress: () => openEditHighlight(hl) },
                  { text: 'Supprimer', style: 'destructive', onPress: () => deleteHighlight(hl.id) },
                ])} activeOpacity={0.7} style={{ alignItems: 'center' }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#3A75C4', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }}>
                    {hl.coverUrl ? <Image source={{ uri: hl.coverUrl }} style={{ width: 60, height: 60, borderRadius: 30 }} /> : <Ionicons name="star-outline" size={28} color="#3A75C4" />}
                  </View>
                  <Text style={{ color: '#ccc', fontSize: 11, marginTop: 4, maxWidth: 64 }} numberOfLines={1}>{hl.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#222' }}>
              {tabs.map((tab) => (
                <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
                  <Ionicons name={tab.icon as any} size={22} color={activeTab === tab.key ? colors.white : '#555'} />
                  {activeTab === tab.key && <View style={{ position: 'absolute', bottom: 0, height: 2, width: 50, backgroundColor: colors.white, borderRadius: 1 }} />}
                </TouchableOpacity>
              ))}
            </View>

            {currentVideos.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 }}>
                <Ionicons name={activeTab === 'grid' ? 'grid-outline' : activeTab === 'reels' ? 'film-outline' : activeTab === 'saved' ? 'bookmark-outline' : 'heart-outline'} size={48} color="#333" />
                <Text style={{ color: '#555', fontSize: 16, fontWeight: '600', marginTop: 12 }}>{activeTab === 'grid' ? 'Aucune vidéo' : activeTab === 'reels' ? 'Aucun reel' : activeTab === 'saved' ? 'Aucune sauvegarde' : 'Aucun like'}</Text>
                <Text style={{ color: '#555', fontSize: 13, marginTop: 4, textAlign: 'center' }}>{activeTab === 'grid' ? 'Les vidéos que tu publies apparaîtront ici' : activeTab === 'reels' ? 'Les reels que tu publies apparaîtront ici' : activeTab === 'saved' ? 'Les vidéos que tu sauvegardes apparaîtront ici' : 'Les vidéos que tu aimes apparaîtront ici'}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={null}
      />
    </SafeAreaView>

    {/* MENU */}
    <Modal transparent visible={menuVisible} animationTransparent onRequestClose={closeMenu}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={closeMenu} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        <Animated.View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34, transform: [{ translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }}>
          <View style={{ paddingVertical: 12, alignItems: 'center' }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444' }} /></View>
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
          <View style={{ height: 1, backgroundColor: '#222', marginVertical: 8 }} />
          <TouchableOpacity onPress={() => { closeMenu(); handleLogout() }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 }}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: 15, fontWeight: '600' }}>Se déconnecter</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>

    {/* SHARE */}
    <Modal transparent visible={shareVisible} animationTransparent onRequestClose={closeShare}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={closeShare} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
        <Animated.View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34, transform: [{ translateY: shareAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }}>
          <View style={{ paddingVertical: 12, alignItems: 'center' }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444' }} /></View>
          <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>Partager le profil</Text>
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#333' }}>
              <Ionicons name="link-outline" size={18} color="#888" style={{ marginRight: 8 }} />
              <Text style={{ flex: 1, color: '#ccc', fontSize: 14 }} numberOfLines={1}>https://mbolo.app/@{profile?.pseudo || 'utilisateur'}</Text>
              <TouchableOpacity onPress={async () => { try { await require('expo-clipboard').setStringAsync(`https://mbolo.app/@${profile?.pseudo || 'utilisateur'}`); Alert.alert('Lien copié', 'Le lien a été copié dans le presse-papiers') } catch {} }} style={{ marginLeft: 8, padding: 4 }}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Copier</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={() => { setShareVisible(false); shareAnim.setValue(0); setTimeout(() => setShowQR(true), 100) }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, marginHorizontal: 16, marginBottom: 16, backgroundColor: '#2a2a2a', borderRadius: 12 }}>
            <Ionicons name="qr-code-outline" size={20} color={colors.white} />
            <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>Code QR</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { try { await Share.share({ message: `Découvre @${profile?.pseudo || 'utilisateur'} sur Mbolo ! 🇬🇦\nhttps://mbolo.app/@${profile?.pseudo || 'utilisateur'}` }) } catch {} }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, marginHorizontal: 16, backgroundColor: '#2a2a2a', borderRadius: 12 }}>
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
            data={`https://mbolo.app/@${profile?.pseudo || 'utilisateur'}`}
            size={200}
            foreground={colors.black}
            background={colors.white}
          />
          <Text style={{ color: '#000', fontSize: 18, fontWeight: '700', marginTop: 16 }}>@{profile?.pseudo || 'utilisateur'}</Text>
          <Text style={{ color: '#666', fontSize: 13, marginTop: 4, textAlign: 'center' }}>Scanne pour voir mon profil Mbolo 🇬🇦</Text>
          <TouchableOpacity
            onPress={async () => {
              try {
                const clip = require('expo-clipboard')
                await clip.setStringAsync(`https://mbolo.app/@${profile?.pseudo || 'utilisateur'}`)
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
    <Modal visible={photoViewerVisible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => setPhotoViewerVisible(false)} style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 }}>
          <Ionicons name="close" size={30} color={colors.white} />
        </TouchableOpacity>
        <Image source={{ uri: profile?.photoURL || '' }} style={{ width: SCREEN_WIDTH * 0.8, height: SCREEN_WIDTH * 0.8, borderRadius: 20 }} resizeMode="contain" />
      </View>
    </Modal>

    {/* HIGHLIGHT VIEWER */}
    <Modal visible={viewerHighlight !== null} transparent animationType="fade">
      {viewerHighlight && (
        <Animated.View style={{ flex: 1, backgroundColor: '#000', transform: [{ translateY: viewerTranslateY }], opacity: viewerOpacity }}>
          <View pointerEvents={viewerOptionsVisible ? 'none' : 'auto'} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 3, paddingHorizontal: 12, paddingTop: 50, paddingBottom: 10 }}>
            {(viewerHighlight.mediaUrls || [viewerHighlight.coverUrl]).map((_: any, i: number) => (
              <View key={i} style={{ flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                <Animated.View style={{ height: '100%', backgroundColor: '#fff', borderRadius: 2, width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: i < viewerMediaIdx ? ['100%', '100%'] : i === viewerMediaIdx ? ['0%', '100%'] : ['0%', '0%'] }) }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#3A75C4', overflow: 'hidden' }}>
              {profile?.photoURL ? <Image source={{ uri: profile.photoURL }} style={{ width: 28, height: 28, borderRadius: 14 }} /> : <Ionicons name="person" size={20} color="#555" />}
            </View>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>{profile?.pseudo || 'Utilisateur'}</Text>
            <Text style={{ color: '#888', fontSize: 12, marginLeft: 6 }}>• {viewerHighlight.title}</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={() => setViewerOptionsVisible(true)}
              style={{ padding: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={closeViewer} style={{ padding: 8 }}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={1} onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Animated.View style={{ width: '100%', height: '100%', opacity: mediaOpacity, transform: [{ translateX: mediaTranslateX }] }}>
            {(() => {
              const media = viewerHighlight.mediaUrls || [viewerHighlight.coverUrl]
              const current = media[viewerMediaIdx]
              if (!current) return <Ionicons name="image-outline" size={64} color="#333" />
              const isVideo = current.includes('.mp4') || current.includes('.mov')
              const displayUrl = getOptimizedUrl(current)
              if (isVideo) return (
                <AVVideo source={{ uri: displayUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" shouldPlay isLooping onReadyForDisplay={() => setMediaLoading(false)} />
              )
              return (
                <Image source={{ uri: displayUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" onLoadEnd={() => setMediaLoading(false)} />
              )
            })()}
            </Animated.View>
            {mediaLoading && <ActivityIndicator size="large" color="#fff" style={{ position: 'absolute' }} />}
          </TouchableOpacity>
          {viewerMediaIdx > 0 && <TouchableOpacity onPress={() => { setViewerMediaIdx(prev => prev - 1); progressAnim.setValue(0) }} onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ position: 'absolute', left: 0, top: 100, bottom: 0, width: '30%' }} activeOpacity={0.3} />}
          <TouchableOpacity onPress={() => { const media = viewerHighlight.mediaUrls || [viewerHighlight.coverUrl]; if (viewerMediaIdx < media.length - 1) { setViewerMediaIdx(prev => prev + 1); progressAnim.setValue(0) } else { closeViewer() } }} onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ position: 'absolute', right: 0, top: 100, bottom: 0, width: '30%' }} activeOpacity={0.3} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{viewerHighlight.title}</Text>
          </LinearGradient>
          </View>

          {/* OPTIONS OVERLAY */}
          {viewerOptionsVisible && viewerHighlight && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <TouchableOpacity activeOpacity={1} onPress={() => setViewerOptionsVisible(false)} style={{ flex: 1 }} />
              <View style={{ backgroundColor: '#1a1a1a', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34 }}>
                <View style={{ paddingVertical: 12, alignItems: 'center' }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444' }} /></View>
                <Text style={{ color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>{viewerHighlight.title}</Text>
                {[
                  {
                    icon: 'pencil-outline' as const,
                    label: 'Modifier le titre',
                    action: () => {
                      setViewerOptionsVisible(false)
                      closeViewer()
                      setTimeout(() => {
                        router.push(`/highlight/${id}`)
                      }, 350)
                    },
                  },
                  {
                    icon: 'images-outline' as const,
                    label: 'Ajouter des médias',
                    action: () => {
                      setViewerOptionsVisible(false)
                      setTimeout(async () => {
                        clearTimeout(timerRef.current)
                        animRef.current?.stop()
                        try {
                          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 0.8, selectionLimit: 10 })
                          if (!result.canceled && result.assets.length > 0 && viewerHighlight) {
                            const urls: string[] = []
                            for (const asset of result.assets) {
                              const url = await uploadMediaToCloudinary(asset.uri)
                              if (url) urls.push(url)
                            }
                            if (urls.length > 0) {
                              const snap = await getDoc(doc(db, 'highlights', viewerHighlight.id))
                              const latest = snap.data()
                              const existing = latest?.mediaUrls || viewerHighlight.mediaUrls || []
                              const allUrls = [...existing, ...urls]
                              await updateDoc(doc(db, 'highlights', viewerHighlight.id), { mediaUrls: allUrls, coverUrl: allUrls[0] })
                              setViewerHighlight({ ...viewerHighlight, mediaUrls: allUrls })
                              return
                            }
                          }
                        } catch (e) { console.error('Ajouter média error:', e) }
                        if (viewerHighlight) {
                          progressTimerStarted.current = false
                          progressAnim.setValue(0)
                          startProgressTimer()
                        }
                      }, 150)
                    },
                  },
                  {
                    icon: 'trash-outline' as const,
                    label: 'Supprimer la mise en avant',
                    color: colors.error,
                    action: () => {
                      setViewerOptionsVisible(false)
                      deleteHighlight(viewerHighlight.id)
                      closeViewer()
                    },
                  },
                ].map((item, i) => (
                  <TouchableOpacity key={i} onPress={item.action} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 20 }}>
                    <Ionicons name={item.icon} size={22} color={item.color || colors.white} />
                    <Text style={{ color: item.color || colors.white, fontSize: 15 }}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      )}
    </Modal>

    {/* STATS MODAL */}
    <Modal visible={statsModal} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '85%', backgroundColor: '#1a1a1a', borderRadius: 16, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>Statistiques</Text>
            <TouchableOpacity onPress={() => setStatsModal(false)}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {[
              { icon: 'videocam-outline', label: 'Vidéos', value: videos.length, color: colors.primary },
              { icon: 'heart-outline', label: 'Likes reçus', value: totalLikes, color: colors.accent },
              { icon: 'eye-outline', label: 'Vues totales', value: totalViews, color: colors.secondary },
              { icon: 'share-social-outline', label: 'Partages', value: totalShares, color: '#9C27B0' },
              { icon: 'people-outline', label: 'Abonnés', value: profile?.followers?.length || 0, color: '#FF5722' },
              { icon: 'person-add-outline', label: 'Abonnements', value: profile?.following?.length || 0, color: '#00BCD4' },
            ].map((stat, i) => (
              <View key={i} style={{ width: '47%', backgroundColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                <Text style={{ color: colors.white, fontSize: 22, fontWeight: '700', marginTop: 6 }}>{stat.value >= 1000 ? `${(stat.value / 1000).toFixed(1)}K` : stat.value}</Text>
                <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>

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
              const isMe = item.id === user?.uid
              const isUserFollowing = item.followers?.includes(user?.uid || '') ?? false
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
    </>
  )
}
