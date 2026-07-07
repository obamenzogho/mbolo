import * as Location from 'expo-location'
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common'
import { collection, query, where, orderBy, startAt, endAt, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'

export async function getCurrentPlace() {
  const { status } = await Location.requestForegroundPermissionsAsync()
  if (status !== 'granted') return null
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
  const [rev] = await Location.reverseGeocodeAsync(pos.coords)
  const lat = pos.coords.latitude, lng = pos.coords.longitude
  return {
    lat, lng, geohash: geohashForLocation([lat, lng]),
    city: rev?.city ?? rev?.region ?? null, country: rev?.country ?? null,
  }
}

export async function getVideosNearby(lat: number, lng: number, radiusKm = 25) {
  const bounds = geohashQueryBounds([lat, lng], radiusKm * 1000)
  const snaps = await Promise.all(bounds.map((b) =>
    getDocs(query(collection(db, 'videos'), orderBy('geohash'), startAt(b[0]), endAt(b[1]))),
  ))
  const seen = new Set<string>()
  const out: any[] = []
  for (const snap of snaps) {
    for (const d of snap.docs) {
      const v = d.data()
      if (!v.lat || seen.has(d.id)) continue
      const dist = distanceBetween([v.lat, v.lng], [lat, lng])
      if (dist <= radiusKm) { seen.add(d.id); out.push({ id: d.id, ...v, distanceKm: dist }) }
    }
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm)
}
