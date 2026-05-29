/* NetworkQuality — singleton de mesure passive du débit.
   Rôle : moyenne glissante des 3 dernières lectures de débit (Mbps).
   Mis à jour par PrefetchQueue après chaque téléchargement.
   Aucune requête réseau dédiée — mesure uniquement sur le trafic réel. */

import { useFeedStore, FEED_DEBUG } from '../store/feedStore'

const readings: number[] = []

export const NetworkQuality = {
  update(mbps: number) {
    readings.push(mbps)
    if (readings.length > 3) readings.shift()
    const quality = NetworkQuality.get()
    useFeedStore.getState().setNetworkQuality(quality)
    if (FEED_DEBUG) console.log('[FEED_DEBUG] NETWORK: new reading', mbps.toFixed(2), 'Mbps →', quality)
  },

  get(): 'FAST' | 'MEDIUM' | 'SLOW' {
    if (readings.length === 0) return 'MEDIUM'
    const avg = readings.reduce((a, b) => a + b, 0) / readings.length
    if (avg >= 5) return 'FAST'
    if (avg >= 1) return 'MEDIUM'
    return 'SLOW'
  },

  refresh() {
    useFeedStore.getState().setNetworkQuality(NetworkQuality.get())
  },
}
