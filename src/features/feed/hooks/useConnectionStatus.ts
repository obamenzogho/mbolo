/* useConnectionStatus — état de connexion agrégé pour le feed.
   Combine :
   - NetInfo : présence/absence de connexion + type (wifi / cellular).
   - Le buffering prolongé du player courant (via markStall/markProgress).
   - La qualité réseau mesurée passivement (feedStore.networkQuality).

   Expose un « niveau » :
   - 'ok'        : tout va bien.
   - 'slow'      : connexion lente / buffering détecté → montrer le loader sur
                   la barre de progression.
   - 'unstable'  : lenteur qui dure (plusieurs minutes) → bandeau d'alerte.
   - 'offline'   : données mobiles / wifi coupés → bandeau spécifique.
*/

import { useEffect, useRef, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { useFeedStore } from '../store/feedStore'

export type ConnectionLevel = 'ok' | 'slow' | 'unstable' | 'offline'

// Buffering continu au-delà de ce seuil → connexion « lente ».
const SLOW_AFTER_MS = 3500
// Lenteur qui persiste au-delà de ce seuil → « instable » (bandeau).
const UNSTABLE_AFTER_MS = 60_000

// Signal de stall partagé (le player courant appelle ces fonctions).
let stallStartedAt: number | null = null
const listeners = new Set<() => void>()

function emit() { listeners.forEach((l) => l()) }

/** Appelé quand le player courant se met à bufferiser / stalle. */
export function markStall() {
  if (stallStartedAt == null) {
    stallStartedAt = Date.now()
    emit()
  }
}

/** Appelé quand le player courant recommence à lire (fin du stall). */
export function markProgress() {
  if (stallStartedAt != null) {
    stallStartedAt = null
    emit()
  }
}

export function useConnectionStatus(): {
  level: ConnectionLevel
  isOffline: boolean
  connectionType: string | null
} {
  const networkQuality = useFeedStore((s) => s.networkQuality)
  const [isOffline, setIsOffline] = useState(false)
  const [connectionType, setConnectionType] = useState<string | null>(null)
  const [stallStart, setStallStart] = useState<number | null>(stallStartedAt)
  const [now, setNow] = useState(() => Date.now())
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Abonnement NetInfo : online/offline + type de connexion.
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false
      setIsOffline(offline)
      setConnectionType(state.type ?? null)
    })
    return unsub
  }, [])

  // Abonnement au signal de stall partagé.
  useEffect(() => {
    const l = () => setStallStart(stallStartedAt)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])

  // Horloge légère : ne tourne QUE pendant un stall (pour évaluer la durée).
  useEffect(() => {
    if (stallStart == null) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
      return
    }
    tickRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null } }
  }, [stallStart])

  let level: ConnectionLevel = 'ok'
  if (isOffline) {
    level = 'offline'
  } else if (stallStart != null) {
    const elapsed = now - stallStart
    if (elapsed >= UNSTABLE_AFTER_MS) level = 'unstable'
    else if (elapsed >= SLOW_AFTER_MS) level = 'slow'
  } else if (networkQuality === 'SLOW') {
    level = 'slow'
  }

  return { level, isOffline, connectionType }
}
