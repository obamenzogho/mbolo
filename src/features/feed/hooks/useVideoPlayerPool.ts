/* useVideoPlayerPool — pool de 5 players (PREV_PREV / PREV / CURRENT / NEXT / NEXT_NEXT).
   Rôle : machine à états (IDLE→LOADING→READY→PLAYING→PAUSED→RECYCLING),
   syncPool() orchestre assign/activate/deactivate/recycle selon currentIndex et isScrolling.
   Enregistre les players dans playerRegistry pour VideoPlayerSlot.

   Stratégie Instagram-like :
   - NEXT / NEXT_NEXT sont pré-chargés en qualité LOW (360p)
   - Quand l'utilisateur arrive sur une vidéo préchargée, elle lit immédiatement
   - Les vidéos non préchargées utilisent la qualité réseau
   - isActive : un feed inactif (onglet non visible) ne joue JAMAIS, même si un
     replaceAsync en vol se résout après la désactivation. */

import { useRef, useCallback, useEffect, useMemo } from 'react'
import { createVideoPlayer } from 'expo-video'
import type { VideoPlayer } from 'expo-video'
import { useFeedStore } from '../store/feedStore'
import { captureException } from '../../../lib/sentry'
import { resolveVideoUrl } from '../services/resolveVideoUrl'
import { setPlayerForVideo, removePlayerForVideo } from '../components/VideoPlayerSlot'
import type { Video } from '../../../types'

const POOL_SIZE = 5

type PlayerState = 'IDLE' | 'LOADING' | 'READY' | 'PLAYING' | 'PAUSED' | 'RECYCLING'
type SlotRole = 'PREV_PREV' | 'PREV' | 'CURRENT' | 'NEXT' | 'NEXT_NEXT'

interface Slot {
  player: VideoPlayer
  videoId: string | null
  state: PlayerState
  role: SlotRole | null
  loadedQuality: 'LOW' | 'FULL' | null
}

function createPoolPlayer(): VideoPlayer {
  const player = createVideoPlayer(null)
  player.loop = true
  // Instagram-like instant playback: minimal buffer, no delay on stalling
  player.bufferOptions = {
    preferredForwardBufferDuration: 2,
    waitsToMinimizeStalling: false,
    minBufferForPlayback: 1,
  }
  return player
}

/** Determine si un rôle est "loin" — chargé en qualité basse */
function isFarRole(role: SlotRole | null): boolean {
  return role === 'NEXT' || role === 'NEXT_NEXT' || role === 'PREV_PREV'
}

export function useVideoPlayerPool(
  instanceId: string,
  onSkipToNext?: (failedVideoId: string) => void,
) {
  const instanceIdRef = useRef(instanceId)
  instanceIdRef.current = instanceId
  const slotsRef = useRef<Slot[]>([])
  const mapRef = useRef<Map<string, number>>(new Map())
  const isScrollingRef = useRef(false)
  const isActiveRef = useRef(true)
  // Timer de libération différée : quand un feed devient inactif, on coupe le son
  // tout de suite mais on ne libère les sources (décodeurs + buffers) qu'après un
  // court délai. Cela évite de recharger inutilement pendant un swipe rapide, tout
  // en libérant vraiment les ressources quand on reste sur un autre onglet.
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (slotsRef.current.length === 0) {
    try {
      slotsRef.current = Array.from({ length: POOL_SIZE }, () => {
        const player = createPoolPlayer()
        return {
          player,
          videoId: null,
          state: 'IDLE' as PlayerState,
          role: null as SlotRole | null,
          loadedQuality: null as 'LOW' | 'FULL' | null,
        }
      })
    } catch (e) {
      throw e
    }
  }

  useEffect(() => {
    return () => {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
      const currentId = instanceIdRef.current
      for (const slot of slotsRef.current) {
        if (slot.videoId) {
          removePlayerForVideo(currentId, slot.videoId)
        }
        try { slot.player.replaceAsync(null) } catch {}
      }
      slotsRef.current = []
      mapRef.current.clear()
    }
  }, [])

  function getSlot(videoId: string): Slot | null {
    const idx = mapRef.current.get(videoId)
    if (idx === undefined) return null
    return slotsRef.current[idx]
  }

  function recycleSlot(slotIdx: number) {
    if (slotIdx < 0 || slotIdx >= slotsRef.current.length) return
    const slot = slotsRef.current[slotIdx]
    if (!slot) return
    const cid = instanceIdRef.current
    if (slot.videoId) {
      removePlayerForVideo(cid, slot.videoId)
      mapRef.current.delete(slot.videoId)
    }
    slot.videoId = null
    slot.state = 'RECYCLING'
    slot.loadedQuality = null
    try { slot.player.currentTime = 0 } catch {}
    try { slot.player.replaceAsync(null) } catch {}
    try { slot.player.pause() } catch {}
    slot.state = 'IDLE'
    slot.role = null
  }

  function findFreeSlot(): number {
    if (slotsRef.current.length === 0) return -1
    // 1. Cherche un slot IDLE
    for (let j = 0; j < slotsRef.current.length; j++) {
      if (slotsRef.current[j].state === 'IDLE') return j
    }
    // 2. Cherche un slot sans videoId
    for (let j = 0; j < slotsRef.current.length; j++) {
      if (slotsRef.current[j].videoId === null) return j
    }
    return -1
  }

  /**
   * Charge une vidéo dans un slot avec la qualité appropriée.
   * Si c'est un slot "loin" (NEXT, NEXT_NEXT, PREV_PREV) → qualité LOW.
   * Sinon → qualité réseau. Un slot LOW déjà prêt n'est pas rechargé
   * lorsqu'il devient CURRENT, afin de ne pas bloquer le démarrage.
   */
  function loadSlot(slot: Slot, videoId: string, video: Video, role: SlotRole) {
    const wantLow = isFarRole(role)

    // Si déjà chargé en FULL pour ce videoId et rôle pas "loin", skip
    if (slot.videoId === videoId && slot.loadedQuality === 'FULL') {
      slot.role = role
      return
    }
    // Si déjà chargé en LOW pour ce videoId et rôle toujours "loin", skip
    if (slot.videoId === videoId && slot.loadedQuality === 'LOW' && wantLow) {
      slot.role = role
      return
    }

    const quality = wantLow ? 'LOW' : 'FULL'
    const uri = resolveVideoUrl(video, wantLow ? 'LOW' : undefined)

    // Nouvelle vidéo dans le slot
    const cid = instanceIdRef.current
    if (slot.videoId) {
      removePlayerForVideo(cid, slot.videoId)
      mapRef.current.delete(slot.videoId)
    }

    slot.videoId = videoId
    slot.role = role
    slot.state = 'LOADING'
    slot.loadedQuality = quality
    mapRef.current.set(videoId, findSlotIndex(slot))
    setPlayerForVideo(cid, videoId, slot.player)

    slot.player.replaceAsync(uri)
      .then(() => {
        if (slot.videoId === videoId) {
          slot.state = 'READY'
          autoPlayIfCurrent(slot)
        }
      })
      .catch((err) => {
        if (slot.videoId === videoId) {
          captureException(err instanceof Error ? err : new Error(String(err)), { context: 'pool:replaceAsync', videoId })
          slot.state = 'IDLE'
          slot.loadedQuality = null
          if (slot.role === 'CURRENT') {
            if (onSkipToNext) {
              onSkipToNext(videoId)
            } else {
              useFeedStore.getState().skipToNext()
            }
          }
        }
      })
  }

  function findSlotIndex(target: Slot): number {
    return slotsRef.current.indexOf(target)
  }

  function pauseNonCurrentSlots(currentVideoId: string | null) {
    for (const slot of slotsRef.current) {
      if (slot.videoId === currentVideoId) continue
      // Pause INCONDITIONNELLE + volume=0 : on ne se fie pas au state suivi (il
      // dérive car play/pause sont async côté expo-video). On coupe toujours
      // l'audio du player sortant via le volume natif (plus fiable que pause()).
      if (slot.state === 'PLAYING') slot.state = 'PAUSED'
      try { slot.player.pause() } catch {}
      try { slot.player.volume = 0 } catch {}
      try { slot.player.currentTime = 0 } catch {}
    }
  }

  function autoPlayIfCurrent(slot: Slot) {
    // Garde d'activité : un feed inactif ne joue jamais, même si le replaceAsync
    // se résout après le changement d'onglet (cause du double son).
    if (!isActiveRef.current) return
    if (slot.role === 'CURRENT' && !isScrollingRef.current) {
      pauseNonCurrentSlots(slot.videoId)
      slot.state = 'PLAYING'
      try { slot.player.volume = 1 } catch {}
      try { slot.player.play() } catch {}
    }
  }

  const syncPool = useCallback(
    (videos: Video[], currentIndex: number, isScrolling: boolean) => {
      if (videos.length === 0 || slotsRef.current.length === 0) return
      isScrollingRef.current = isScrolling

      // Calcul des indices cibles
      const prevPrevIdx = currentIndex - 2
      const prevIdx = currentIndex - 1
      const nextIdx = currentIndex + 1
      const nextNextIdx = currentIndex + 2

      const prevPrevId = prevPrevIdx >= 0 ? videos[prevPrevIdx].id : null
      const prevId = prevIdx >= 0 ? videos[prevIdx].id : null
      const currentId = videos[currentIndex].id
      const nextId = nextIdx < videos.length ? videos[nextIdx].id : null
      const nextNextId = nextNextIdx < videos.length ? videos[nextNextIdx].id : null

      // Ordre des rôles par priorité (CURRENT en premier pour avoir le slot le plus vite)
      const roleTargets: { role: SlotRole; videoId: string | null; videoIdx: number }[] = [
        { role: 'CURRENT', videoId: currentId, videoIdx: currentIndex },
        { role: 'NEXT', videoId: nextId, videoIdx: nextIdx },
        { role: 'NEXT_NEXT', videoId: nextNextId, videoIdx: nextNextIdx },
        { role: 'PREV', videoId: prevId, videoIdx: prevIdx },
        { role: 'PREV_PREV', videoId: prevPrevId, videoIdx: prevPrevIdx },
      ]

      const targetSet = new Set(
        roleTargets.filter(t => t.videoId !== null).map(t => t.videoId!),
      )

      // 1. Recycle les vidéos hors de la fenêtre 5
      for (const [videoId] of mapRef.current) {
        if (!targetSet.has(videoId)) {
          const slotIdx = mapRef.current.get(videoId)
          if (slotIdx !== undefined) recycleSlot(slotIdx)
        }
      }

      // 2. Assigne les slots pour les vidéos cibles
      for (const target of roleTargets) {
        const { role, videoId, videoIdx } = target
        if (!videoId) continue

        // Si déjà assigné, met à jour le rôle
        if (mapRef.current.has(videoId)) {
          const slotIdx = mapRef.current.get(videoId)!
          const existingSlot = slotsRef.current[slotIdx]
          if (existingSlot) {
            existingSlot.role = role
            if (role === 'CURRENT') {
              autoPlayIfCurrent(existingSlot)
            }
          }
          continue
        }

        // Trouve un slot libre
        const freeIdx = findFreeSlot()
        if (freeIdx === -1) break

        const slot = slotsRef.current[freeIdx]
        const video = videos[videoIdx]
        loadSlot(slot, videoId, video, role)
      }

      pauseNonCurrentSlots(currentId)

      // 3. Activation selon isScrolling ET isActive
      if (!isScrolling && isActiveRef.current) {
        const currentSlot = currentId ? getSlot(currentId) : null

        // Joue CURRENT si prêt
        if (currentSlot && currentSlot.state === 'READY') {
          pauseNonCurrentSlots(currentId)
          currentSlot.state = 'PLAYING'
          try { currentSlot.player.volume = 1 } catch {}
          try { currentSlot.player.play() } catch {}
        }
      }
    },
    [],
  )

  /** Met en pause TOUS les slots du pool (pas juste le current). */
  const pauseAll = useCallback(() => {
    for (const slot of slotsRef.current) {
      if (slot.state === 'PLAYING') slot.state = 'PAUSED'
      try { slot.player.pause() } catch {}
      try { slot.player.volume = 0 } catch {}
    }
  }, [])

  /** Libère les sources de TOUS les slots (décodeurs + buffers), sans détruire
   *  les players eux-mêmes. Appelé quand le feed reste inactif : c'est ce qui
   *  fait vraiment retomber la conso CPU/GPU (et la chauffe) d'un onglet non
   *  visible. Le pool se recharge via syncPool à la réactivation. */
  const releaseAllSources = useCallback(() => {
    const cid = instanceIdRef.current
    for (let i = 0; i < slotsRef.current.length; i++) {
      const slot = slotsRef.current[i]
      if (!slot.videoId && slot.state === 'IDLE') continue
      recycleSlot(i)
    }
    mapRef.current.clear()
  }, [])

  /** Bascule l'état actif du feed. Sur désactivation, coupe tout le pool et
   *  programme la libération des sources après un court délai (anti-thrash swipe). */
  const setActive = useCallback((active: boolean) => {
    isActiveRef.current = active
    if (active) {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current)
        releaseTimerRef.current = null
      }
      return
    }
    // Inactif : coupe immédiatement lecture + son…
    for (const slot of slotsRef.current) {
      if (slot.state === 'PLAYING') slot.state = 'PAUSED'
      try { slot.player.pause() } catch {}
      try { slot.player.volume = 0 } catch {}
    }
    // …puis libère les sources si le feed reste inactif au-delà du délai.
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
    releaseTimerRef.current = setTimeout(() => {
      releaseTimerRef.current = null
      if (!isActiveRef.current) releaseAllSources()
    }, 500)
  }, [releaseAllSources])

  const getPlayer = useCallback((videoId: string): VideoPlayer | null => {
    const slot = getSlot(videoId)
    return slot?.player ?? null
  }, [])

  const getPlayerState = useCallback((videoId: string): PlayerState | null => {
    const slot = getSlot(videoId)
    return slot?.state ?? null
  }, [])

  return useMemo(
    () => ({ syncPool, getPlayer, getPlayerState, setActive, pauseAll }),
    [syncPool, getPlayer, getPlayerState, setActive, pauseAll],
  )
}
