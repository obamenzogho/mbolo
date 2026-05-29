/* useVideoPlayerPool — pool de 3 players (PREV / CURRENT / NEXT).
   Rôle : machine à états (IDLE→LOADING→READY→PLAYING→PAUSED→RECYCLING),
   syncPool() orchestre assign/activate/deactivate/recycle selon currentIndex et isScrolling.
   Enregistre les players dans playerRegistry pour VideoPlayerSlot. */

import { useRef, useCallback, useEffect, useMemo } from 'react'
import { createVideoPlayer } from 'expo-video'
import type { VideoPlayer } from 'expo-video'
import { useFeedStore, FEED_DEBUG } from '../store/feedStore'
import { captureException } from '../../../lib/sentry'
import { resolveVideoUrl } from '../services/resolveVideoUrl'
import { setPlayerForVideo, removePlayerForVideo } from '../components/VideoPlayerSlot'
import type { Video } from '../../../types'

const POOL_SIZE = 3

type PlayerState = 'IDLE' | 'LOADING' | 'READY' | 'PLAYING' | 'PAUSED' | 'RECYCLING'

interface Slot {
  player: VideoPlayer
  videoId: string | null
  state: PlayerState
  role: 'PREV' | 'CURRENT' | 'NEXT' | null
}

function createPoolPlayer(): VideoPlayer {
  const player = createVideoPlayer(null)
  player.loop = true
  return player
}

export function useVideoPlayerPool(
  instanceId: string,
  onSkipToNext?: (failedVideoId: string) => void,
) {
  const instanceIdRef = useRef(instanceId)
  instanceIdRef.current = instanceId
  const slotsRef = useRef<Slot[]>([])
  const mapRef = useRef<Map<string, number>>(new Map())

  if (slotsRef.current.length === 0) {
    slotsRef.current = Array.from({ length: POOL_SIZE }, () => ({
      player: createPoolPlayer(),
      videoId: null,
      state: 'IDLE' as PlayerState,
      role: null as 'PREV' | 'CURRENT' | 'NEXT' | null,
    }))
  }

  useEffect(() => {
    return () => {
      const currentId = instanceIdRef.current
      for (const slot of slotsRef.current) {
        if (slot.videoId) {
          removePlayerForVideo(currentId, slot.videoId)
        }
        slot.player.replace(null)
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
    const slot = slotsRef.current[slotIdx]
    const cid = instanceIdRef.current
    if (slot.videoId) {
      removePlayerForVideo(cid, slot.videoId)
      mapRef.current.delete(slot.videoId)
    }
    slot.videoId = null
    slot.state = 'RECYCLING'
    slot.player.currentTime = 0
    slot.player.replace(null)
    slot.player.pause()
    slot.state = 'IDLE'
    slot.role = null
  }

  const syncPool = useCallback(
    (videos: Video[], currentIndex: number, isScrolling: boolean) => {
      if (videos.length === 0) return

      const prevIdx = currentIndex - 1
      const nextIdx = currentIndex + 1
      const prevPrevIdx = currentIndex - 2

      const prevId = prevIdx >= 0 ? videos[prevIdx].id : null
      const currentId = videos[currentIndex].id
      const nextId = nextIdx < videos.length ? videos[nextIdx].id : null
      const prevPrevId = prevPrevIdx >= 0 ? videos[prevPrevIdx].id : null

      const targetIds: (string | null)[] = [prevId, currentId, nextId]
      const targetSet = new Set(targetIds.filter((id): id is string => id !== null))

      // Recycle PREV's PREV (furthest away)
      if (prevPrevId !== null && mapRef.current.has(prevPrevId)) {
        const slotIdx = mapRef.current.get(prevPrevId)!
        if (FEED_DEBUG) console.log('[FEED_DEBUG] POOL: recycle', prevPrevId)
        recycleSlot(slotIdx)
      }

      // Recycle any assigned video not in target range
      for (const [videoId] of mapRef.current) {
        if (!targetSet.has(videoId)) {
          const slotIdx = mapRef.current.get(videoId)!
          if (FEED_DEBUG) console.log('[FEED_DEBUG] POOL: recycle (out of range)', videoId)
          recycleSlot(slotIdx)
        }
      }

      // Assign slots for new target videos
      const roleOrder: ('PREV' | 'CURRENT' | 'NEXT')[] = ['PREV', 'CURRENT', 'NEXT']
      for (let i = 0; i < targetIds.length; i++) {
        const videoId = targetIds[i]
        if (!videoId) continue

        if (mapRef.current.has(videoId)) {
          const slotIdx = mapRef.current.get(videoId)!
          slotsRef.current[slotIdx].role = roleOrder[i]
          continue
        }

        // Find a free slot (IDLE)
        let freeSlotIdx = -1
        for (let j = 0; j < POOL_SIZE; j++) {
          if (slotsRef.current[j].state === 'IDLE') {
            freeSlotIdx = j
            break
          }
        }

        // If no IDLE slot, find RECYCLING or the one with no videoId
        if (freeSlotIdx === -1) {
          for (let j = 0; j < POOL_SIZE; j++) {
            if (slotsRef.current[j].videoId === null) {
              freeSlotIdx = j
              break
            }
          }
        }

        if (freeSlotIdx === -1) break

        const slot = slotsRef.current[freeSlotIdx]
        const video = videos[i === 0 ? prevIdx : i === 1 ? currentIndex : nextIdx]
        const uri = resolveVideoUrl(video)

        slot.videoId = videoId
        slot.role = roleOrder[i]
        slot.state = 'LOADING'
        mapRef.current.set(videoId, freeSlotIdx)
        setPlayerForVideo(instanceIdRef.current, videoId, slot.player)

        if (FEED_DEBUG) console.log('[FEED_DEBUG] POOL: assign', videoId, 'as', roleOrder[i])

        slot.player.replaceAsync(uri)
          .then(() => {
            if (slot.videoId === videoId) {
              slot.state = 'READY'
              if (FEED_DEBUG) console.log('[FEED_DEBUG] POOL: ready', videoId)
              const s = useFeedStore.getState()
              if (s.pendingActivation && slot.role === 'CURRENT' && !s.isScrolling) {
                slot.state = 'PLAYING'
                slot.player.play()
                s.setPendingActivation(false)
                if (FEED_DEBUG) console.log('[FEED_DEBUG] POOL: pending activate', videoId)
              }
            }
          })
          .catch((err) => {
            if (slot.videoId === videoId) {
              if (FEED_DEBUG) console.log('[FEED_DEBUG] POOL: replaceAsync error', videoId, err)
              captureException(err instanceof Error ? err : new Error(String(err)), { context: 'pool:replaceAsync', videoId })
              slot.state = 'IDLE'
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

      // Now activate/deactivate based on isScrolling
      const currentSlot = currentId ? getSlot(currentId) : null
      const prevSlot = prevId ? getSlot(prevId) : null
      const nextSlotObj = nextId ? getSlot(nextId) : null

      if (!isScrolling) {
        // Activate CURRENT (also handles pendingActivation from background resume)
        if (currentSlot && currentSlot.state === 'READY') {
          currentSlot.state = 'PLAYING'
          currentSlot.player.play()
          if (FEED_DEBUG) console.log('[FEED_DEBUG] POOL: activate PLAYING', currentId)
          if (useFeedStore.getState().pendingActivation) {
            useFeedStore.getState().setPendingActivation(false)
          }
        }

        // Deactivate PREV (pause + seek 0)
        if (prevSlot && prevSlot.state === 'PLAYING') {
          prevSlot.state = 'PAUSED'
          prevSlot.player.currentTime = 0
          prevSlot.player.pause()
          if (FEED_DEBUG) console.log('[FEED_DEBUG] POOL: deactivate PAUSED', prevId)
        }

        // Ensure NEXT is READY (paused)
        if (nextSlotObj && (nextSlotObj.state === 'PLAYING' || nextSlotObj.state === 'PAUSED')) {
          nextSlotObj.state = 'READY'
          nextSlotObj.player.pause()
          if (FEED_DEBUG) console.log('[FEED_DEBUG] POOL: next READY', nextId)
        }
      }
    },
    [],
  )

  const getPlayer = useCallback((videoId: string): VideoPlayer | null => {
    const slot = getSlot(videoId)
    return slot?.player ?? null
  }, [])

  const getPlayerState = useCallback((videoId: string): PlayerState | null => {
    const slot = getSlot(videoId)
    return slot?.state ?? null
  }, [])

  return useMemo(
    () => ({ syncPool, getPlayer, getPlayerState }),
    [syncPool, getPlayer, getPlayerState],
  )
}
