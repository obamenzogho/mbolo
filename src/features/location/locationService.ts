import * as Location from 'expo-location'
import { geohashForLocation } from 'geofire-common'

export interface Place {
  lat: number
  lng: number
  geohash: string
  city: string | null
  country: string | null
  source: 'gps' | 'network'
}

async function reverseCity(lat: number, lng: number): Promise<{ city: string | null; country: string | null }> {
  try {
    const [rev] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
    return { city: rev?.city ?? rev?.subregion ?? rev?.region ?? null, country: rev?.country ?? null }
  } catch {
    return { city: null, country: null }
  }
}

function toPlace(lat: number, lng: number, city: string | null, country: string | null, source: 'gps' | 'network'): Place {
  return { lat, lng, geohash: geohashForLocation([lat, lng]), city, country, source }
}

// ─── GPS (position précise de l'appareil) ───
// Robuste : permission, service activé, haute précision, timeout, et repli sur
// la dernière position connue UNIQUEMENT si elle est récente (sinon on risque
// d'afficher une ancienne ville, ex. la capitale d'un précédent trajet).
const STALE_FIX_MS = 10 * 60 * 1000 // 10 min : au-delà, la position est jugée périmée

export async function getGpsPlace(): Promise<Place | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync()
    if (status !== 'granted') return null

    const enabled = await Location.hasServicesEnabledAsync().catch(() => true)

    // Dernière position connue, seulement si récente.
    const freshLastKnown = async () => {
      const last = await Location.getLastKnownPositionAsync({ maxAge: STALE_FIX_MS }).catch(() => null)
      return last?.coords ?? null
    }

    if (!enabled) {
      const coords = await freshLastKnown()
      if (!coords) return null
      const { city, country } = await reverseCity(coords.latitude, coords.longitude)
      return toPlace(coords.latitude, coords.longitude, city, country, 'gps')
    }

    // Fix frais en haute précision (course avec un timeout pour ne pas bloquer).
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000)),
    ])
    const coords = pos?.coords ?? (await freshLastKnown())
    if (!coords) return null

    const { city, country } = await reverseCity(coords.latitude, coords.longitude)
    return toPlace(coords.latitude, coords.longitude, city, country, 'gps')
  } catch {
    return null
  }
}

// ─── Réseau (géolocalisation approximative par IP) ───
// Fonctionne SANS permission et SANS GPS : idéal comme repli pour connaître la
// ville de l'utilisateur. Précision ~ville, pas au mètre.
export async function getNetworkPlace(): Promise<Place | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    // ipwho.is : HTTPS, gratuit, sans clé.
    const res = await fetch('https://ipwho.is/', { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return null
    const d: any = await res.json()
    if (!d?.success || typeof d.latitude !== 'number' || typeof d.longitude !== 'number') return null
    return toPlace(d.latitude, d.longitude, d.city ?? null, d.country ?? null, 'network')
  } catch {
    return null
  }
}

// ─── Meilleure position disponible ───
// GPS d'abord (précis), sinon repli réseau. À utiliser pour l'onglet « ville ».
export async function getBestPlace(): Promise<Place | null> {
  const gps = await getGpsPlace()
  if (gps) return gps
  return getNetworkPlace()
}

// Compat : ancienne API précise (permission + GPS). Conserve le comportement
// attendu par l'upload vidéo (attacher une position précise à la vidéo).
export async function getCurrentPlace(): Promise<Place | null> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return null
  return getGpsPlace()
}
