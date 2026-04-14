/* useUserLocation — expose la localisation courante pour le feed « près de chez
   toi ». On privilégie TOUJOURS la position GPS réelle (précise). Le repli
   réseau (géoloc par IP) n'est utilisé qu'en tout dernier recours, car il
   renvoie souvent la ville du fournisseur d'accès (ex. la capitale) et non la
   position réelle de l'utilisateur.
   - au montage : si la permission GPS est déjà accordée, on résout la position
     précise ; sinon on n'affiche PAS de ville trompeuse — l'onglet reste « À
     proximité » jusqu'au clic ;
   - request() (clic sur l'onglet) : demande la permission GPS et résout la
     position réelle ; repli réseau seulement si le GPS échoue totalement.
   Un cache module-level conserve le dernier lieu connu entre remontages. */

import { useCallback, useEffect, useState } from 'react'
import { Linking } from 'react-native'
import * as Location from 'expo-location'
import { getGpsPlace, getNetworkPlace, type Place } from './locationService'

export type { Place }

// 'granted' = position GPS précise ; 'approx' = ville connue via le réseau (IP).
export type LocationStatus = 'unknown' | 'loading' | 'granted' | 'approx' | 'denied'

// Persiste entre remontages du hook (le PagerView remonte les écrans).
let cachedPlace: Place | null = null

export function useUserLocation() {
  const [place, setPlace] = useState<Place | null>(cachedPlace)
  const [status, setStatus] = useState<LocationStatus>(
    cachedPlace ? (cachedPlace.source === 'gps' ? 'granted' : 'approx') : 'unknown',
  )

  const apply = useCallback((p: Place | null) => {
    if (p) {
      cachedPlace = p
      setPlace(p)
      setStatus(p.source === 'gps' ? 'granted' : 'approx')
      return true
    }
    return false
  }, [])

  // Au montage : GPS uniquement si la permission est déjà accordée. On ne fait
  // PAS de repli réseau ici — mieux vaut « À proximité » qu'une fausse ville.
  useEffect(() => {
    // Si on n'a qu'une position approximative en cache, on tente de la remplacer
    // par la vraie position GPS dès que possible.
    if (cachedPlace && cachedPlace.source === 'gps') return
    let cancelled = false
    ;(async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync()
        if (cancelled) return
        if (perm.status === 'granted') {
          setStatus('loading')
          const gps = await getGpsPlace()
          if (cancelled) return
          if (apply(gps)) return
        }
        if (!cachedPlace) setStatus(perm.status === 'denied' ? 'denied' : 'unknown')
      } catch {
        if (!cancelled && !cachedPlace) setStatus('unknown')
      }
    })()
    return () => { cancelled = true }
  }, [apply])

  // Clic sur l'onglet ville : on obtient la position GPS réelle.
  const request = useCallback(async () => {
    setStatus('loading')
    try {
      const current = await Location.getForegroundPermissionsAsync()
      // Refus définitif : on renvoie vers les réglages système.
      if (current.status === 'denied' && !current.canAskAgain) {
        Linking.openSettings().catch(() => {})
        // Dernier recours : ville approximative réseau, en attendant.
        const net = await getNetworkPlace()
        if (!apply(net)) setStatus('denied')
        return
      }
      const perm = await Location.requestForegroundPermissionsAsync()
      if (perm.status === 'granted') {
        const gps = await getGpsPlace()
        if (apply(gps)) return
      } else {
        setStatus('denied')
        return
      }
      // Permission accordée mais GPS en échec total → repli réseau approximatif.
      const net = await getNetworkPlace()
      if (!apply(net)) setStatus('denied')
    } catch {
      const net = await getNetworkPlace().catch(() => null)
      if (!apply(net)) setStatus('denied')
    }
  }, [apply])

  return { place, status, request }
}
