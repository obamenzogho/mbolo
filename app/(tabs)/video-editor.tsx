import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, Image, TextInput,
  Modal, Dimensions, Alert, ScrollView, Animated,
  PanResponder, StyleSheet, ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Video as AVVideo } from 'expo-av'
import AnimatedReanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import * as VideoThumbnails from 'expo-video-thumbnails'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { uploadToCloudinary } from '../../src/lib/cloudinary'
import OrbitLoader from '../../src/components/OrbitLoader'
import {
  initFFmpeg,
  getTempPath,
  cleanupTemp,
  trimVideo,
  changeSpeed,
  applyVideoFilter,
  compressVideo,
  flipVideo,
  rotateVideo,
  muteVideo,
  getVideoInfo,
  cancelAllOperations,
  VideoFilter,
  FFmpegResult,
} from '../../utils/ffmpeg'
import { useCamera } from '../../src/hooks/useCamera'
import DraggableElement, { DeleteZone } from '../../src/components/DraggableElement'
import { MBOLO_FILTERS, getCssFilter, getPreviewStyle } from '../../utils/filters'
import GifPicker from '../../src/components/GifPicker'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const PREVIEW_HEIGHT = SCREEN_HEIGHT * 0.48
const TRIM_HEIGHT = 50
const THUMB_WIDTH = 50
const TAB_WIDTH = SCREEN_WIDTH / 5

const SPEED_OPTIONS = [0.3, 0.5, 1, 2, 3]

const TEXT_COLORS = ['#FFFFFF', '#000000', '#FF0000', '#00A86B', '#FFD700', '#00BFFF', '#FF69B4', '#FF8C00']

const SUGGESTED_HASHTAGS = ['#Gabon', '#Mbolo', '#Libreville', '#Afrique', '#241', '#GabonTikTok', '#PourToi']

type TextAlignMode = 'left' | 'center' | 'right'
type TextBgMode = 'none' | 'tinted' | 'black' | 'white'
type ActiveTab = 'clips' | 'audio' | 'text' | 'stickers' | 'filters' | 'effects' | 'format' | 'speed' | 'voice'

interface TextOverlayItem {
  id: string
  text: string
  color: string
  size: number
  bold: boolean
  italic: boolean
  align: TextAlignMode
  bg: TextBgMode
  x: number
  y: number
  rotation: number
}

interface GifOverlayItem {
  id: string
  uri: string
  width: number
  height: number
  x: number
  y: number
  scale: number
  rotation: number
}

interface HistoryEntry {
  textOverlays: TextOverlayItem[]
  gifOverlays: GifOverlayItem[]
  activeFilterIdx: number
  filterIntensity: number
  speed: number
  trimStart: number
  trimEnd: number
}

export default function VideoEditorScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { mediaUri, mediaType } = useLocalSearchParams<{ mediaUri?: string; mediaType?: string }>()
  const { pickFromGallery } = useCamera()

  const [activeTab, setActiveTab] = useState<ActiveTab>('filters')
  const [activeFilterIdx, setActiveFilterIdx] = useState(0)
  const [filterIntensity, setFilterIntensity] = useState(100)
  const [speed, setSpeed] = useState(1)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showPlayIcon, setShowPlayIcon] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [description, setDescription] = useState('')
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([])

  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(100)
  const [videoDuration, setVideoDuration] = useState(5000)
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [draggingTrim, setDraggingTrim] = useState<'left' | 'right' | null>(null)
  const [cursorPosition, setCursorPosition] = useState(0)
  const cursorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [textOverlays, setTextOverlays] = useState<TextOverlayItem[]>([])
  const [gifOverlays, setGifOverlays] = useState<GifOverlayItem[]>([])
  const [showTextEditor, setShowTextEditor] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [textColor, setTextColor] = useState('#FFFFFF')
  const [textSize, setTextSize] = useState(24)
  const [textBold, setTextBold] = useState(false)
  const [textItalic, setTextItalic] = useState(false)
  const [textAlign, setTextAlign] = useState<TextAlignMode>('center')
  const [textBg, setTextBg] = useState<TextBgMode>('none')
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [isDraggingElement, setIsDraggingElement] = useState(false)

  const [showSoundPanel, setShowSoundPanel] = useState(false)
  const [soundSearch, setSoundSearch] = useState('')
  const [selectedSound, setSelectedSound] = useState<string | null>(null)
  const [originalVolume, setOriginalVolume] = useState(100)
  const [soundVolume, setSoundVolume] = useState(50)

  const [showTextOverlayEditor, setShowTextOverlayEditor] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState('')

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const [videoInfo, setVideoInfo] = useState<any>(null)
  const [processedVideoUri, setProcessedVideoUri] = useState<string | null>(null)
  const [appliedSpeed, setAppliedSpeed] = useState(1)
  const [appliedFilter, setAppliedFilter] = useState<string>('')
  const [appliedFlip, setAppliedFlip] = useState<'horizontal' | 'vertical' | null>(null)
  const [appliedRotation, setAppliedRotation] = useState(0)

  const videoRef = useRef<AVVideo>(null)
  const previewRef = useRef<View>(null)
  const lastTapRef = useRef<number>(0)
  const rotationRef = useRef<any>(null)

  useEffect(() => {
    initFFmpeg().catch(console.error)
  }, [])

  useEffect(() => {
    return () => {
      cleanupTemp().catch(() => {})
      cancelAllOperations()
    }
  }, [])

  useEffect(() => {
    if (!mediaUri || mediaType !== 'video') return
    const loadVideo = async () => {
      try {
        const info = await getVideoInfo(mediaUri)
        if (info) {
          setVideoInfo(info)
          setVideoDuration(info.duration * 1000)
        }
        const count = 12
        const thumbs: string[] = []
        const intervalSec = (info?.duration || 5) / count
        for (let i = 0; i < count; i++) {
          const { uri } = await VideoThumbnails.getThumbnailAsync(mediaUri, { time: i * intervalSec * 1000 })
          thumbs.push(uri)
        }
        setThumbnails(thumbs)
      } catch (e) {
        console.error('Video info error:', e)
        const thumbs: string[] = []
        for (let i = 0; i < 12; i++) {
          try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(mediaUri, { time: i * 500 })
            thumbs.push(uri)
          } catch {}
        }
        setThumbnails(thumbs)
        setVideoDuration(5000)
      }
    }
    loadVideo()
  }, [mediaUri, mediaType])

  useEffect(() => {
    if (isPlaying && mediaType === 'video') {
      cursorIntervalRef.current = setInterval(() => {
        setCursorPosition(prev => {
          const next = prev + (100 / (videoDuration / 1000))
          if (next >= 100) return 0
          return next
        })
      }, 1000)
    }
    return () => { if (cursorIntervalRef.current) clearInterval(cursorIntervalRef.current) }
  }, [isPlaying, videoDuration, mediaType])

  const saveState = useCallback(() => {
    const entry: HistoryEntry = {
      textOverlays: [...textOverlays],
      gifOverlays: [...gifOverlays],
      activeFilterIdx,
      filterIntensity,
      speed,
      trimStart,
      trimEnd,
    }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(entry)
    if (newHistory.length > 50) newHistory.shift()
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [textOverlays, activeFilterIdx, filterIntensity, speed, trimStart, trimEnd, history, historyIndex])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1]
      setTextOverlays(prev.textOverlays)
      setActiveFilterIdx(prev.activeFilterIdx)
      setFilterIntensity(prev.filterIntensity)
      setSpeed(prev.speed)
      setTrimStart(prev.trimStart)
      setTrimEnd(prev.trimEnd)
      setHistoryIndex(i => i - 1)
    }
  }, [history, historyIndex])

  const getFilterStyle = (): string => {
    const f = MBOLO_FILTERS[activeFilterIdx]
    const filter = f?.cssFilter || ''
    if (!filter || filterIntensity === 0) return ''
    if (filterIntensity === 100) return filter
    const intensity = filterIntensity / 100
    const parts = filter.split(' ').map(p => {
      if (p.includes('grayscale')) return `grayscale(${parseFloat(p.match(/[\d.]+/)?.[0] || '1') * intensity})`
      if (p.includes('sepia')) return `sepia(${parseFloat(p.match(/[\d.]+/)?.[0] || '1') * intensity})`
      if (p.includes('saturate')) return `saturate(${1 + (parseFloat(p.match(/[\d.]+/)?.[0] || '1') - 1) * intensity})`
      if (p.includes('contrast')) return `contrast(${1 + (parseFloat(p.match(/[\d.]+/)?.[0] || '1') - 1) * intensity})`
      if (p.includes('brightness')) return `brightness(${1 + (parseFloat(p.match(/[\d.]+/)?.[0] || '1') - 1) * intensity})`
      if (p.includes('hue-rotate')) return `hue-rotate(${parseFloat(p.match(/[\d.]+/)?.[0] || '0') * intensity}deg)`
      return p
    })
    return parts.join(' ')
  }

  const togglePlay = useCallback(() => {
    if (isPlaying) videoRef.current?.pauseAsync()
    else videoRef.current?.playAsync()
    setIsPlaying(!isPlaying)
    setShowPlayIcon(true)
    setTimeout(() => setShowPlayIcon(false), 1000)
  }, [isPlaying])

  const processVideo = useCallback(async (
    steps: Array<{ label: string; fn: () => Promise<FFmpegResult> }>
  ): Promise<string> => {
    let currentUri = mediaUri!
    setProcessing(true)
    setUploadProgress(0)

    try {
      for (const step of steps) {
        setProcessingStep(step.label)
        setUploadProgress(0)
        const result = await step.fn()
        if (!result.success) {
          Alert.alert('Erreur', `${step.label} a échoué: ${result.error}`)
          return mediaUri!
        }
        if (result.output) currentUri = result.output
      }
      return currentUri
    } finally {
      setProcessing(false)
      setProcessingStep('')
      setUploadProgress(0)
    }
  }, [mediaUri])

  const handleSpeedChange = useCallback(async (newSpeed: number) => {
    if (newSpeed === appliedSpeed) return
    setProcessingStep('Changement de vitesse...')
    setProcessing(true)

    const outPath = getTempPath(`speed_${Date.now()}.mp4`)
    const result = await changeSpeed(processedVideoUri || mediaUri!, newSpeed, outPath)
    setProcessing(false)
    setProcessingStep('')

    if (result.success && result.output) {
      setProcessedVideoUri(result.output)
      setAppliedSpeed(newSpeed)
      setSpeed(newSpeed)
      saveState()
    } else {
      Alert.alert('Erreur', 'Impossible de changer la vitesse')
    }
  }, [appliedSpeed, processedVideoUri, mediaUri, saveState])

  const handleFilterChange = useCallback(async (filterIdx: number) => {
    const f = MBOLO_FILTERS[filterIdx]
    const ffmpegFilter = f?.ffmpegFilter
    if (!ffmpegFilter || filterIdx === 0) {
      setActiveFilterIdx(filterIdx)
      setAppliedFilter('')
      if (processedVideoUri && processedVideoUri !== mediaUri) {
        try { await cleanupTemp() } catch {}
        setProcessedVideoUri(null)
      }
      saveState()
      return
    }

    setProcessingStep('Application du filtre...')
    setProcessing(true)

    const input = processedVideoUri || mediaUri!
    const outPath = getTempPath(`filter_${Date.now()}.mp4`)
    const result = await applyVideoFilter(input, ffmpegFilter as any, outPath)
    setProcessing(false)
    setProcessingStep('')

    if (result.success && result.output) {
      setProcessedVideoUri(result.output)
      setAppliedFilter(ffmpegFilter)
      setActiveFilterIdx(filterIdx)
      saveState()
    } else {
      Alert.alert('Erreur', 'Impossible d\'appliquer le filtre')
    }
  }, [processedVideoUri, mediaUri, saveState])

  const handleFlip = useCallback(async (direction: 'horizontal' | 'vertical') => {
    setProcessingStep('Retournement...')
    setProcessing(true)

    const input = processedVideoUri || mediaUri!
    const outPath = getTempPath(`flip_${Date.now()}.mp4`)
    const result = await flipVideo(input, direction, outPath)
    setProcessing(false)
    setProcessingStep('')

    if (result.success && result.output) {
      setProcessedVideoUri(result.output)
      setAppliedFlip(direction)
      saveState()
    } else {
      Alert.alert('Erreur', 'Impossible de retourner la vidéo')
    }
  }, [processedVideoUri, mediaUri, saveState])

  const handleMute = useCallback(async () => {
    setProcessingStep('Suppression du son...')
    setProcessing(true)

    const input = processedVideoUri || mediaUri!
    const outPath = getTempPath(`mute_${Date.now()}.mp4`)
    const result = await muteVideo(input, outPath)
    setProcessing(false)
    setProcessingStep('')

    if (result.success && result.output) {
      setProcessedVideoUri(result.output)
      setOriginalVolume(0)
      saveState()
    } else {
      Alert.alert('Erreur', 'Impossible de couper le son')
    }
  }, [processedVideoUri, mediaUri, saveState])

  const handleCompress = useCallback(async (quality: 'high' | 'medium' | 'low') => {
    setProcessingStep(`Compression ${quality}...`)
    setProcessing(true)

    const input = processedVideoUri || mediaUri!
    const outPath = getTempPath(`compress_${quality}_${Date.now()}.mp4`)
    const result = await compressVideo(input, outPath, quality)
    setProcessing(false)
    setProcessingStep('')

    if (result.success && result.output) {
      setProcessedVideoUri(result.output)
      Alert.alert('Compression', `Vidéo compressée en qualité ${quality}`)
    } else {
      Alert.alert('Erreur', 'Impossible de compresser la vidéo')
    }
  }, [processedVideoUri, mediaUri])

  const trimLeftPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_evt, gs) => {
      const trimWidth = (thumbnails.length * (THUMB_WIDTH + 2))
      const delta = (gs.dx / trimWidth) * 100
      setTrimStart(prev => Math.max(0, Math.min(prev + delta, trimEnd - 5)))
    },
    onPanResponderGrant: () => setDraggingTrim('left'),
    onPanResponderRelease: () => { setDraggingTrim(null); saveState() },
  })).current

  const trimRightPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_evt, gs) => {
      const trimWidth = (thumbnails.length * (THUMB_WIDTH + 2))
      const delta = (gs.dx / trimWidth) * 100
      setTrimEnd(prev => Math.max(trimStart + 5, Math.min(prev + delta, 100)))
    },
    onPanResponderGrant: () => setDraggingTrim('right'),
    onPanResponderRelease: () => { setDraggingTrim(null); saveState() },
  })).current

  

  const handleDoubleTap = useCallback((item: TextOverlayItem) => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      setEditingTextId(item.id)
      setTextInput(item.text)
      setTextColor(item.color)
      setTextSize(item.size)
      setTextBold(item.bold)
      setTextItalic(item.italic)
      setTextAlign(item.align)
      setTextBg(item.bg)
      setShowTextOverlayEditor(true)
    }
    lastTapRef.current = now
  }, [])

  const saveTextOverlay = useCallback(() => {
    if (!textInput.trim()) { setShowTextOverlayEditor(false); return }
    if (editingTextId) {
      setTextOverlays(prev => prev.map(t =>
        t.id === editingTextId ? { ...t, text: textInput.trim(), color: textColor, size: textSize, bold: textBold, italic: textItalic, align: textAlign, bg: textBg } : t
      ))
    } else {
      setTextOverlays(prev => [...prev, {
        id: Date.now().toString(), text: textInput.trim(), color: textColor, size: textSize,
        bold: textBold, italic: textItalic, align: textAlign, bg: textBg,
        x: SCREEN_WIDTH / 2 - 80, y: PREVIEW_HEIGHT / 2 - 30, rotation: 0,
      }])
    }
    setShowTextOverlayEditor(false)
    saveState()
  }, [textInput, textColor, textSize, textBold, textItalic, textAlign, textBg, editingTextId, saveState])

  const goToPublish = useCallback(() => {
    const finalUri = processedVideoUri || mediaUri
    router.push({
      pathname: '/post',
      params: {
        mediaUri: finalUri,
        mediaType,
        description: description || '',
        filter: MBOLO_FILTERS[activeFilterIdx]?.name || 'Normal',
        filterIntensity: String(filterIntensity),
        speed: String(speed),
        trimStart: String(trimStart),
        trimEnd: String(trimEnd),
        textOverlays: JSON.stringify(textOverlays),
        hashtags: selectedHashtags.join(','),
        selectedSound: selectedSound || '',
      },
    })
  }, [router, mediaUri, mediaType, description, activeFilterIdx, filterIntensity, speed, trimStart, trimEnd, textOverlays, selectedHashtags, selectedSound, processedVideoUri])

  const toggleHashtag = (tag: string) => {
    setSelectedHashtags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  if (!mediaUri) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name="videocam-off" size={64} color="#333" />
        <Text style={{ color: '#555', fontSize: 16, marginTop: 16 }}>Aucun média</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Retour</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const selectedDuration = ((trimEnd - trimStart) / 100) * videoDuration
  const selectedSec = Math.round(selectedDuration / 1000)

  const RIGHT_TOOLS = [
    { id: 'audio', icon: 'volume-medium', label: 'Son', action: () => { setActiveTab('audio'); setShowSoundPanel(true) } },
    { id: 'text', icon: 'text', label: 'Texte', action: () => { setEditingTextId(null); setTextInput(''); setShowTextOverlayEditor(true) } },
    { id: 'stickers', icon: 'happy', label: 'Stickers', action: () => setActiveTab('stickers') },
    { id: 'filters', icon: 'color-filter', label: 'Filtres', action: () => setActiveTab('filters') },
    { id: 'speed', icon: 'speedometer', label: 'Vitesse', action: () => setActiveTab('speed') },
    { id: 'effects', icon: 'brightness', label: 'Effets', action: () => setActiveTab('effects') },
    { id: 'flip', icon: 'camera-reverse', label: 'Retourner', action: () => {
      Alert.alert('Retourner', 'Comment veux-tu retourner ?', [
        { text: 'Horizontal', onPress: () => handleFlip('horizontal') },
        { text: 'Vertical', onPress: () => handleFlip('vertical') },
        { text: 'Annuler', style: 'cancel' },
      ])
    } },
  ]

  const BOTTOM_TABS: { id: ActiveTab; label: string }[] = [
    { id: 'clips', label: 'Clips' },
    { id: 'audio', label: 'Audio' },
    { id: 'text', label: 'Texte' },
    { id: 'stickers', label: 'Stickers' },
    { id: 'filters', label: 'Filtres' },
    { id: 'effects', label: 'Effets' },
    { id: 'format', label: 'Format' },
    { id: 'speed', label: 'Vitesse' },
    { id: 'voice', label: 'Voix off' },
  ]

  const tabIndicator = useSharedValue(BOTTOM_TABS.findIndex(t => t.id === 'filters') * TAB_WIDTH)
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(tabIndicator.value, { damping: 20, stiffness: 200 }) }],
  }))

  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab)
    const idx = BOTTOM_TABS.findIndex(t => t.id === tab)
    if (idx >= 0) tabIndicator.value = idx * TAB_WIDTH
  }, [])

  const displayUri = processedVideoUri || mediaUri

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* PROCESSING OVERLAY */}
      {processing && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, justifyContent: 'center', alignItems: 'center' }}>
          <OrbitLoader size={80} />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 16 }}>{processingStep}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8 }}>Traitement en cours...</Text>
        </View>
      )}

      {/* HEADER */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#000' }}>
        <TouchableOpacity onPress={() => Alert.alert('Quitter', 'Fermer l\'éditeur ?', [{ text: 'Annuler' }, { text: 'Quitter', style: 'destructive', onPress: () => { cancelAllOperations(); router.back() } }])} style={{ padding: 6 }}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={undo} disabled={historyIndex <= 0} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: historyIndex > 0 ? '#1a1a1a' : 'transparent' }}>
            <Text style={{ color: historyIndex > 0 ? '#fff' : '#444', fontSize: 13, fontWeight: '600' }}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToPublish} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: '#00A86B' }}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Suivant →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* PRÉVIEW */}
      <View ref={previewRef} style={{ width: '100%', height: PREVIEW_HEIGHT, backgroundColor: '#000', overflow: 'hidden' }}>
        <View style={{ width: '100%', height: '100%', transform: [{ rotate: `${appliedRotation}deg` }] }}>
          {mediaType === 'video' ? (
            <AVVideo
              ref={videoRef}
              source={{ uri: displayUri }}
              style={{ width: '100%', height: '100%', transform: [{ scaleX: appliedFlip === 'horizontal' ? -1 : 1 }, { scaleY: appliedFlip === 'vertical' ? -1 : 1 }] }}
              shouldPlay={isPlaying}
              isLooping
              rate={speed}
            />
          ) : (
            <Image source={{ uri: mediaUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          )}
        </View>

        {showPlayIcon && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={48} color="#fff" />
          </View>
        )}

        {textOverlays.map(item => {
          const bgStyle = item.bg === 'tinted' ? { backgroundColor: item.color + '80', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }
            : item.bg === 'black' ? { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }
            : item.bg === 'white' ? { backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 } : {}
          return (
            <DraggableElement
              key={item.id}
              initialPosition={{ x: item.x, y: item.y }}
              onDelete={() => {
                setTextOverlays(prev => prev.filter(t => t.id !== item.id))
                saveState()
              }}
              onEdit={() => handleDoubleTap(item)}
              onPositionChange={(x, y) => {
                setTextOverlays(prev => prev.map(t => t.id === item.id ? { ...t, x, y } : t))
              }}
              onDragStart={() => setIsDraggingElement(true)}
              onDragEnd={() => setIsDraggingElement(false)}
            >
              <View style={bgStyle}>
                <Text style={{ color: item.color, fontSize: item.size, fontWeight: item.bold ? '800' : item.italic ? '400' : '400', fontStyle: item.italic ? 'italic' : 'normal', textAlign: item.align, textShadowColor: item.bg === 'none' ? 'rgba(0,0,0,0.8)' : 'transparent', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 }}>{item.text}</Text>
              </View>
            </DraggableElement>
          )
        })}

        {gifOverlays.map(gif => (
          <DraggableElement
            key={gif.id}
            initialPosition={{ x: gif.x, y: gif.y }}
            onDelete={() => {
              setGifOverlays(prev => prev.filter(g => g.id !== gif.id))
              saveState()
            }}
            onPositionChange={(x, y) => {
              setGifOverlays(prev => prev.map(g => g.id === gif.id ? { ...g, x, y } : g))
            }}
            onDragStart={() => setIsDraggingElement(true)}
            onDragEnd={() => setIsDraggingElement(false)}
          >
            <Image
              source={{ uri: gif.uri }}
              style={{ width: gif.width, height: gif.height, borderRadius: 4 }}
              resizeMode="contain"
            />
          </DraggableElement>
        ))}

        </View>

        <TouchableOpacity onPress={togglePlay} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={0.3} />

      {/* OUTILS DROITE */}
      <View style={{ position: 'absolute', right: 8, top: SCREEN_HEIGHT * 0.1, zIndex: 10 }}>
        {RIGHT_TOOLS.map(tool => (
          <TouchableOpacity key={tool.id} onPress={tool.action} style={{ alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: activeTab === tool.id ? '#00A86B' : '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name={tool.icon as any} size={20} color="#fff" />
            </View>
            <Text style={{ color: activeTab === tool.id ? '#00A86B' : '#888', fontSize: 10, marginTop: 3 }}>{tool.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* BARRE TRIM */}
      {mediaType === 'video' && thumbnails.length > 0 && (
        <View style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginBottom: 4, textAlign: 'center' }}>
            {Math.floor(selectedSec / 60)}:{(selectedSec % 60).toString().padStart(2, '0')}
          </Text>
          <View style={{ height: TRIM_HEIGHT, position: 'relative' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row' }}>
                {thumbnails.map((uri, i) => (
                  <View key={i} style={{ position: 'relative', width: THUMB_WIDTH, height: TRIM_HEIGHT, marginRight: 2 }}>
                    <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: 4 }} />
                    {((i / thumbnails.length) * 100 < trimStart || (i / thumbnails.length) * 100 > trimEnd) && (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4 }} />
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
            <Animated.View {...trimLeftPan.panHandlers} style={{ position: 'absolute', left: `${trimStart}%`, top: 0, width: 12, height: TRIM_HEIGHT, backgroundColor: '#FFD700', borderRadius: 3, justifyContent: 'center', alignItems: 'center', zIndex: 5 }}>
              <Text style={{ color: '#000', fontSize: 8 }}>◀</Text>
            </Animated.View>
            <Animated.View {...trimRightPan.panHandlers} style={{ position: 'absolute', left: `${trimEnd}%`, top: 0, width: 12, height: TRIM_HEIGHT, backgroundColor: '#FFD700', borderRadius: 3, justifyContent: 'center', alignItems: 'center', zIndex: 5 }}>
              <Text style={{ color: '#000', fontSize: 8 }}>▶</Text>
            </Animated.View>
            <View style={{ position: 'absolute', left: `${cursorPosition}%`, top: 0, width: 2, height: TRIM_HEIGHT, backgroundColor: '#fff', zIndex: 4 }} />
          </View>
        </View>
      )}

      {/* ONGLET ACTIF */}
      <View style={{ height: 120 + insets.bottom, backgroundColor: '#111', paddingBottom: insets.bottom }}>
        {activeTab === 'filters' && (
          <View style={{ padding: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {MBOLO_FILTERS.map((f, idx) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => {
                    setActiveFilterIdx(idx)
                    handleFilterChange(idx)
                  }}
                  style={{ alignItems: 'center' }}
                >
                  <View style={{
                    width: 70,
                    height: 90,
                    borderRadius: 8,
                    overflow: 'hidden',
                    borderWidth: 2,
                    borderColor: activeFilterIdx === idx ? '#00A86B' : '#333',
                  }}>
                    {thumbnails[0] ? (
                      <Image
                        source={{ uri: thumbnails[0] }}
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <View style={{ width: '100%', height: '100%', backgroundColor: '#222' }} />
                    )}
                    {f.previewStyle && (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...f.previewStyle }} />
                    )}
                    {f.id === 'normal' && (
                      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: 0.3 }} />
                    )}
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>
                        {f.name}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {activeFilterIdx > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 8 }}>
                <TouchableOpacity onPress={() => setFilterIntensity(p => Math.max(0, p - 10))} style={{ padding: 4 }}>
                  <Ionicons name="remove-circle" size={18} color="#888" />
                </TouchableOpacity>
                <View style={{ flex: 1, height: 4, backgroundColor: '#333', borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${filterIntensity}%`, backgroundColor: '#00A86B', borderRadius: 2 }} />
                </View>
                <TouchableOpacity onPress={() => setFilterIntensity(p => Math.min(100, p + 10))} style={{ padding: 4 }}>
                  <Ionicons name="add-circle" size={18} color="#888" />
                </TouchableOpacity>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', minWidth: 32, textAlign: 'right' }}>{filterIntensity}%</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'speed' && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, padding: 20 }}>
            {SPEED_OPTIONS.map(s => (
              <TouchableOpacity key={s} onPress={() => handleSpeedChange(s)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: speed === s ? '#fff' : '#222' }}>
                <Text style={{ color: speed === s ? '#000' : '#fff', fontSize: 14, fontWeight: '700' }}>{s}x</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'audio' && (
          <View style={{ padding: 12 }}>
            {selectedSound ? (
              <View>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{selectedSound}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <Ionicons name="musical-notes" size={16} color="#888" />
                  <Text style={{ color: '#888', fontSize: 12 }}>Son original</Text>
                  <View style={{ flex: 1, height: 4, backgroundColor: '#333', borderRadius: 2 }}>
                    <View style={{ height: '100%', width: `${originalVolume}%`, backgroundColor: '#00A86B', borderRadius: 2 }} />
                  </View>
                  <Text style={{ color: '#fff', fontSize: 10 }}>{originalVolume}%</Text>
                </View>
                <TouchableOpacity onPress={handleMute} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: '#222', borderRadius: 8, alignSelf: 'flex-start' }}>
                  <Ionicons name="volume-mute" size={18} color="#FF4444" />
                  <Text style={{ color: '#FF4444', fontSize: 12, fontWeight: '600' }}>Couper le son</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setShowSoundPanel(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
                <Ionicons name="musical-notes" size={24} color="#00A86B" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Ajouter un son</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {activeTab === 'text' && (
          <View style={{ padding: 12 }}>
            <TouchableOpacity onPress={() => { setEditingTextId(null); setTextInput(''); setShowTextOverlayEditor(true) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#1a1a1a', borderRadius: 12 }}>
              <Ionicons name="add-circle" size={24} color="#00A86B" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Ajouter un texte</Text>
            </TouchableOpacity>
            {textOverlays.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, gap: 8 }}>
                {textOverlays.map(t => (
                  <TouchableOpacity key={t.id} onPress={() => { setEditingTextId(t.id); setTextInput(t.text); setTextColor(t.color); setTextSize(t.size); setTextBold(t.bold); setTextItalic(t.italic); setTextAlign(t.align); setTextBg(t.bg); setShowTextOverlayEditor(true) }} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#222', borderRadius: 8, marginRight: 6 }}>
                    <Text style={{ color: t.color, fontSize: 12, fontWeight: t.bold ? '700' : '400' }} numberOfLines={1}>{t.text}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {activeTab === 'effects' && (
          <View style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { label: 'Compression haute', quality: 'high' as const, icon: 'compress' },
                { label: 'Compression moyenne', quality: 'medium' as const, icon: 'resize' },
                { label: 'Compression faible', quality: 'low' as const, icon: 'expand' },
              ].map((opt) => (
                <TouchableOpacity key={opt.label} onPress={() => handleCompress(opt.quality)} style={{ flex: 1, padding: 14, backgroundColor: '#1a1a1a', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' }}>
                  <Ionicons name={opt.icon as any} size={24} color={colors.primary} />
                  <Text style={{ color: colors.text, fontSize: 11, marginTop: 6, textAlign: 'center' }}>{opt.label.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'voice' && (
          <View style={{ padding: 12, alignItems: 'center' }}>
            <TouchableOpacity style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF4444', justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="mic" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Appuie pour enregistrer</Text>
          </View>
        )}

        {activeTab === 'stickers' && (
          <GifPicker
            onSelect={(gifUrl, gifResult) => {
              setGifOverlays(prev => [...prev, {
                id: Date.now().toString(),
                uri: gifUrl,
                width: 120,
                height: 120,
                x: SCREEN_WIDTH / 2 - 60,
                y: PREVIEW_HEIGHT / 2 - 60,
                scale: 1,
                rotation: 0,
              }])
            }}
          />
        )}

        {(activeTab === 'clips' || activeTab === 'format') && (
          <View style={{ justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Ionicons name="construct" size={32} color="#333" />
            <Text style={{ color: '#555', fontSize: 13, marginTop: 8 }}>Bientôt disponible</Text>
          </View>
        )}
      </View>

      {/* ONGLETS BAS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: '#000', borderTopWidth: 0.5, borderTopColor: '#222', paddingBottom: insets.bottom }} contentContainerStyle={{ paddingHorizontal: 8 }}>
            <AnimatedReanimated.View style={[{ position: 'absolute', left: 0, top: 0, width: TAB_WIDTH, height: 2, backgroundColor: '#00A86B' }, tabIndicatorStyle]} />
            {BOTTOM_TABS.map(tab => (
          <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} style={{ paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: activeTab === tab.id ? '#fff' : '#888', fontSize: 13, fontWeight: activeTab === tab.id ? '700' : '400' }}>{tab.label}</Text>
            {activeTab === tab.id && <View style={{ width: 20, height: 2, backgroundColor: '#00A86B', borderRadius: 1, marginTop: 4 }} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* MODAL TEXTE OVERLAY */}
      <Modal visible={showTextOverlayEditor} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ backgroundColor: '#111', paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', paddingHorizontal: 10, gap: 6, alignItems: 'center' }}>
              {TEXT_COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => setTextColor(c)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: 2, borderColor: textColor === c ? '#fff' : 'transparent' }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 4, borderLeftWidth: 1, borderLeftColor: '#333', marginLeft: 6, paddingLeft: 10, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setTextBold(!textBold)} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: textBold ? '#333' : 'transparent' }}>
                <Text style={{ color: '#fff', fontWeight: textBold ? '900' : '400' }}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTextItalic(!textItalic)} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, backgroundColor: textItalic ? '#333' : 'transparent' }}>
                <Text style={{ color: '#fff', fontStyle: 'italic' }}>I</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 4, borderLeftWidth: 1, borderLeftColor: '#333', marginLeft: 6, paddingLeft: 10, alignItems: 'center' }}>
              {(['left', 'center', 'right'] as TextAlignMode[]).map(a => (
                <TouchableOpacity key={a} onPress={() => setTextAlign(a)} style={{ padding: 4 }}>
                  <Ionicons name={a === 'left' ? 'reorder-three-outline' : a === 'center' ? 'reorder-two-outline' : 'menu-outline'} size={16} color={textAlign === a ? '#fff' : '#888'} />
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 4, borderLeftWidth: 1, borderLeftColor: '#333', marginLeft: 6, paddingLeft: 10, alignItems: 'center' }}>
              {([['none', 'A⁻'], ['tinted', 'A▫'], ['black', 'A■'], ['white', 'A□']] as [TextBgMode, string][]).map(([m, l]) => (
                <TouchableOpacity key={m} onPress={() => setTextBg(m)} style={{ padding: 4 }}>
                  <Text style={{ color: textBg === m ? '#fff' : '#888', fontSize: 12 }}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
            <TextInput value={textInput} onChangeText={setTextInput} placeholder="Tape ton texte..." placeholderTextColor="#555" maxLength={200} multiline autoFocus textAlignVertical="center" style={{ color: textColor, fontSize: textSize, fontWeight: textBold ? '800' : '400', fontStyle: textItalic ? 'italic' : 'normal', textAlign: textAlign, width: '100%', minHeight: 60 }} />
          </View>

          <View style={{ flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 40, gap: 12 }}>
            <TouchableOpacity onPress={() => setShowTextOverlayEditor(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#333', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveTextOverlay} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#00A86B', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{editingTextId ? 'Modifier' : 'Ajouter'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PANNEAU SON */}
      <Modal visible={showSoundPanel} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Ajouter un son</Text>
              <TouchableOpacity onPress={() => setShowSoundPanel(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <TextInput value={soundSearch} onChangeText={setSoundSearch} placeholder="Rechercher un son..." placeholderTextColor="#555" style={{ backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 12, margin: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 }} />
            <ScrollView style={{ maxHeight: 400 }}>
              {[
                { title: 'Afrobeats Mix 2024', artist: 'DJ Libreville', duration: '2:34' },
                { title: 'Tendance Gabon 🇬🇦', artist: 'Mbolo Sounds', duration: '1:48' },
                { title: 'Rumba Congolaise', artist: 'Fally Ipupa', duration: '3:12' },
                { title: 'Amapiano Vibes', artist: 'DJ Maphorisa', duration: '2:56' },
              ].map((s, i) => (
                <TouchableOpacity key={i} onPress={() => { setSelectedSound(s.title); setShowSoundPanel(false) }} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name="musical-notes" size={22} color="#00A86B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{s.title}</Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>{s.artist} · {s.duration}</Text>
                  </View>
                  <TouchableOpacity style={{ padding: 8 }}>
                    <Ionicons name="add-circle" size={24} color="#00A86B" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <DeleteZone isVisible={isDraggingElement} />
    </View>
  )
}
