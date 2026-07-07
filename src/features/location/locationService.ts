import * as Location from 'expo-location'
import { geohashForLocation } from 'geofire-common'

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
