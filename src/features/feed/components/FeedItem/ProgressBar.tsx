import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { savePosition } from '../../services/positionTracker'
import { markStall, markProgress } from '../../hooks/useConnectionStatus'
import { ProgressBarLoader } from './ProgressBarLoader'

interface ProgressBarProps {
  player: any
  videoId?: string
  isActive?: boolean
  // Pause VOLONTAIRE (tap/long-press). Seule cette pause épaissit la barre et
  // affiche le pouce + minuteur. Un arrêt involontaire (stall réseau, swipe,
  // démarrage) ne doit PAS grossir la barre.
  userPaused?: boolean
  bottomOffset?: number
  translateY?: Animated.Value
}

const fmtTime = (secs: number) => {
  const s = Math.max(0, Math.floor(secs))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export const ProgressBar = memo(function ProgressBar({ player, videoId, isActive = false, userPaused = false, bottomOffset = 65, translateY }: ProgressBarProps) {
  const insets = useSafeAreaInsets()
  const { width: SCREEN_WIDTH } = useWindowDimensions()

  // Ref synchronisée pour lire l'intention de pause dans les listeners natifs
  // sans re-souscrire à chaque changement.
  const userPausedRef = useRef(userPaused)
  userPausedRef.current = userPaused

  // La track est en retrait de PAD de chaque côté : les calculs de seek et la
  // position de la pastille doivent en tenir compte, sinon le doigt et la
  // position réelle sont décalés (bug « seek imprécis »).
  const PAD = 16

  const [isSeeking, setIsSeeking] = useState(false)
  const [seekInfo, setSeekInfo] = useState<{ label: string; x: number } | null>(null)
  // Temps courant / durée affichés quand la vidéo est en pause.
  const [timeInfo, setTimeInfo] = useState<{ current: number; duration: number } | null>(null)
  // Buffering du player courant → loader animé sur la barre.
  const [buffering, setBuffering] = useState(false)

  const [progressAnim] = useState(() => new Animated.Value(0))
  const [barOpacity] = useState(() => new Animated.Value(1))
  const [activeAnim] = useState(() => new Animated.Value(0)) // 0 = fine, 1 = épaissie (scrub)
  const progressValueRef = useRef(0)
  const barWidthRef = useRef(SCREEN_WIDTH)
  const lastSeekApplyRef = useRef(0)
  const isSeekingRef = useRef(false)
  isSeekingRef.current = isSeeking
  const seekGestureTakenRef = useRef(false)

  // Convertit une coordonnée X (dans le conteneur pleine largeur) en ratio 0..1
  // borné à la zone utile de la track.
  const xToRatio = useCallback((x: number) => {
    const usable = Math.max(1, barWidthRef.current - PAD * 2)
    return Math.max(0, Math.min(1, (x - PAD) / usable))
  }, [])

  const setProgress = useCallback((ratio: number) => {
    const r = Math.max(0, Math.min(1, ratio))
    progressValueRef.current = r
    try { progressAnim.setValue(r) } catch {}
  }, [progressAnim])

  useEffect(() => {
    if (!player) { setProgress(0); return }
    player.timeUpdateEventInterval = 0.1
    const subs = [
      player.addListener('timeUpdate', ({ currentTime }: { currentTime: number }) => {
        if (isSeekingRef.current) return
        const dur = player.duration
        if (dur && dur > 0) {
          setProgress(currentTime / dur)
          setTimeInfo({ current: currentTime, duration: dur })
          // Mémorise la position pour reprise ultérieure (throttlé côté tracker).
          if (videoId) savePosition(videoId, currentTime, dur)
        }
      }),
      player.addListener('playingChange', ({ isPlaying: next }: { isPlaying: boolean }) => {
        // À la pause, on fige le temps courant/durée pour l'afficher.
        if (!next) {
          try {
            const dur = player.duration
            if (dur && dur > 0) setTimeInfo({ current: player.currentTime, duration: dur })
          } catch {}
        }
      }),
      player.addListener('sourceChange', () => { setProgress(0); setTimeInfo(null) }),
    ]
    return () => {
      subs.forEach((s) => s.remove())
      try { player.timeUpdateEventInterval = 0 } catch {}
      setProgress(0)
    }
  }, [player, videoId, setProgress])

  // Opacité de la barre : pleine (surbrillance) UNIQUEMENT sur pause volontaire
  // ou scrub. En lecture — y compris au recommencement/boucle ou après une
  // reprise de stall — elle s'atténue à 0.3 après 1,5 s. On ne dépend PAS de
  // isPlaying (qui clignote à false quand la vidéo boucle → rallumage parasite).
  useEffect(() => {
    if (!userPaused && !isSeeking) {
      barOpacity.setValue(1)
      const t = setTimeout(() => {
        Animated.timing(barOpacity, { toValue: 0.3, duration: 500, useNativeDriver: true }).start()
      }, 1500)
      return () => clearTimeout(t)
    }
    barOpacity.setValue(1)
  }, [userPaused, isSeeking, barOpacity])

  // Buffering / reprise auto de la vidéo active :
  // - status 'loading' pendant la lecture = la vidéo cale → loader (après un
  //   court délai anti-flash) + signal de stall partagé (bandeau connexion).
  // - status 'readyToPlay' de retour = le buffer s'est rempli → on relance la
  //   lecture SI la pause n'était pas volontaire (sinon la vidéo resterait
  //   figée après une connexion lente).
  useEffect(() => {
    if (!player || !isActive) { setBuffering(false); return }
    let loaderTimer: ReturnType<typeof setTimeout> | null = null
    const clearLoaderTimer = () => { if (loaderTimer) { clearTimeout(loaderTimer); loaderTimer = null } }

    const handler = ({ status }: { status: string }) => {
      if (status === 'loading') {
        // Pas de loader si l'utilisateur a mis en pause volontairement.
        if (userPausedRef.current) return
        markStall()
        clearLoaderTimer()
        loaderTimer = setTimeout(() => setBuffering(true), 500)
      } else {
        clearLoaderTimer()
        setBuffering(false)
        markProgress()
        // Reprise auto après un stall (jamais si pause volontaire).
        if (status === 'readyToPlay' && !userPausedRef.current) {
          try { if (!player.playing) player.play() } catch {}
        }
      }
    }
    try { player.addListener('statusChange', handler) } catch {}
    return () => {
      clearLoaderTimer()
      try { player.removeListener('statusChange', handler) } catch {}
      markProgress()
    }
  }, [player, isActive])

  // La barre ne s'épaissit QUE sur pause VOLONTAIRE (tap) — pas au scroll, au
  // scrub, au démarrage ni pendant un stall. Idem pour le pouce + minuteur.
  useEffect(() => {
    Animated.timing(activeAnim, {
      toValue: userPaused ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start()
  }, [userPaused, activeAnim])

  const seekBegin = useCallback(() => {
    isSeekingRef.current = true
    setIsSeeking(true)
    barOpacity.setValue(1)
  }, [barOpacity])

  const seekUpdate = useCallback((ratio: number) => {
    if (!player) return
    const dur = player.duration
    if (!dur || dur <= 0) return
    setProgress(ratio)
    // Applique la position en continu (throttle ~60 ms) pour que l'image suive
    // le doigt sans saturer le player.
    const now = Date.now()
    if (now - lastSeekApplyRef.current > 60) {
      lastSeekApplyRef.current = now
      try { player.currentTime = ratio * dur } catch {}
    }
    const totalSecs = Math.round(ratio * dur)
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    const usable = Math.max(1, barWidthRef.current - PAD * 2)
    setSeekInfo({ label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, x: PAD + ratio * usable })
  }, [player, setProgress])

  const seekEnd = useCallback(() => {
    isSeekingRef.current = false
    setIsSeeking(false)
    setSeekInfo(null)
    if (player) {
      try {
        const dur = player.duration
        if (dur && dur > 0) player.currentTime = progressValueRef.current * dur
      } catch {}
    }
  }, [player])

  const seekBeginRef = useRef(seekBegin); seekBeginRef.current = seekBegin
  const seekUpdateRef = useRef(seekUpdate); seekUpdateRef.current = seekUpdate
  const seekEndRef = useRef(seekEnd); seekEndRef.current = seekEnd
  const xToRatioRef = useRef(xToRatio); xToRatioRef.current = xToRatio

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        if (Math.abs(g.dx) > 5) { seekGestureTakenRef.current = true; return true }
        return false
      },
      onPanResponderGrant: (evt) => {
        seekBeginRef.current()
        const locX = evt.nativeEvent?.locationX ?? 0
        seekUpdateRef.current(xToRatioRef.current(locX))
      },
      onPanResponderMove: (_, g) => {
        seekUpdateRef.current(xToRatioRef.current(g.moveX))
      },
      onPanResponderRelease: () => { seekGestureTakenRef.current = false; seekEndRef.current() },
      onPanResponderTerminate: () => { seekGestureTakenRef.current = false; seekEndRef.current() },
    }),
  ).current

  if (!player) return null

  return (
    <Animated.View
      {...panResponder.panHandlers}
      onLayout={(e) => { barWidthRef.current = e.nativeEvent.layout.width }}
      style={[
        styles.container,
        { bottom: bottomOffset + insets.bottom, opacity: barOpacity },
        translateY ? { transform: [{ translateY }] } : null,
      ]}
    >
      <Animated.View style={[styles.track, {
        height: activeAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 6] }),
        borderRadius: activeAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 6] }),
        backgroundColor: activeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.45)'],
        }),
      }]}>
        <Animated.View
          style={[styles.fill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </Animated.View>

      {/* Connexion lente : boules OrbitLoader (vert/jaune/bleu) qui glissent de
          gauche à droite le long de la barre pendant que la vidéo bufferise.
          Affiché dès que ça cale (le player s'arrête → isPlaying false), SAUF
          si l'utilisateur a mis en pause volontairement. */}
      {buffering && !userPaused && (
        <ProgressBarLoader width={Math.max(1, barWidthRef.current - PAD * 2)} left={PAD} />
      )}

      {(userPaused || isSeeking) && (
        <>
          <Animated.View
            style={[styles.thumb, {
              left: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [PAD, SCREEN_WIDTH - PAD] }),
              transform: [
                { translateX: -9 },
                { scale: activeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
              ],
            }]}
          />
          {seekInfo && (
            <View style={[styles.timeLabel, { left: Math.max(20, Math.min(seekInfo.x - 26, SCREEN_WIDTH - 72)) }]}>
              <Text style={styles.timeText}>{seekInfo.label}</Text>
            </View>
          )}
        </>
      )}

      {/* Pause volontaire (hors scrub) : temps courant / durée, centré au-dessus. */}
      {userPaused && !isSeeking && timeInfo && timeInfo.duration > 0 && (
        <View pointerEvents="none" style={styles.pauseTimeRow}>
          <View style={styles.pauseTime}>
            <Text style={styles.timeText}>
              {fmtTime(timeInfo.current)} / {fmtTime(timeInfo.duration)}
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  )
})

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, height: 60, justifyContent: 'flex-end' },
  track: { marginHorizontal: 16, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#00C853', borderRadius: 6 },
  thumb: {
    position: 'absolute', bottom: -6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#00C853', borderWidth: 2, borderColor: '#FFF',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2,
  },
  timeLabel: {
    position: 'absolute', bottom: 34, backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  pauseTimeRow: {
    position: 'absolute', left: 0, right: 0, bottom: 18, alignItems: 'center',
  },
  pauseTime: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  timeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
})
