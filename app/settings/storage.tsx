import { useState, useEffect, useCallback } from 'react'
import { Alert } from 'react-native'
import * as FileSystem from 'expo-file-system'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SettingsScreen, SettingsSection, SettingsRow } from '@/features/settings/components'

const CACHED_FEED_KEY = '@mbolo_cached_feed'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 Mo'
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} Ko`
  if (mb < 1024) return `${mb.toFixed(1)} Mo`
  return `${(mb / 1024).toFixed(2)} Go`
}

async function dirSize(uri: string | null | undefined): Promise<number> {
  if (!uri) return 0
  try {
    const info = await (FileSystem as any).getInfoAsync(uri, { size: true })
    if (!info?.exists) return 0
    if (!info.isDirectory) return info.size ?? 0
    const entries: string[] = await (FileSystem as any).readDirectoryAsync(uri)
    let total = 0
    for (const name of entries) {
      total += await dirSize(`${uri}${uri.endsWith('/') ? '' : '/'}${name}`)
    }
    return total
  } catch {
    return 0
  }
}

export default function StorageSettings() {
  const [cacheSize, setCacheSize] = useState<string>('—')
  const [computing, setComputing] = useState(true)

  const compute = useCallback(async () => {
    setComputing(true)
    const cacheDir = (FileSystem as any).cacheDirectory as string | undefined
    const size = await dirSize(cacheDir)
    setCacheSize(formatBytes(size))
    setComputing(false)
  }, [])

  useEffect(() => { compute() }, [compute])

  const handleClearCache = () => {
    Alert.alert(
      'Vider le cache',
      'Les vidéos et images téléchargées seront re-téléchargées à la demande. Tes réglages et ton compte ne sont pas affectés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Vider',
          style: 'destructive',
          onPress: async () => {
            const cacheDir = (FileSystem as any).cacheDirectory as string | undefined
            try {
              if (cacheDir) {
                const entries: string[] = await (FileSystem as any).readDirectoryAsync(cacheDir)
                await Promise.all(
                  entries.map((name) =>
                    (FileSystem as any)
                      .deleteAsync(`${cacheDir}${name}`, { idempotent: true })
                      .catch(() => {}),
                  ),
                )
              }
              // Cache feed disque (miroir), sans toucher aux réglages/session.
              await AsyncStorage.removeItem(CACHED_FEED_KEY).catch(() => {})
            } catch {
              // best-effort
            }
            compute()
          },
        },
      ],
    )
  }

  return (
    <SettingsScreen title="Stockage">
      <SettingsSection title="Cache" footer="Le cache accélère le chargement des vidéos déjà vues. Le vider libère de l'espace sans supprimer tes données.">
        <SettingsRow
          icon="albums-outline"
          label="Cache de l'application"
          kind="value"
          value={computing ? '…' : cacheSize}
        />
        <SettingsRow
          icon="trash-outline"
          label="Vider le cache"
          kind="action"
          destructive
          onPress={handleClearCache}
          divider={false}
        />
      </SettingsSection>

      <SettingsSection title="Mes données" footer="L'export d'une archive complète de tes données arrive bientôt.">
        <SettingsRow
          icon="download-outline"
          label="Télécharger mes données"
          description="Bientôt disponible"
          kind="action"
          onPress={() =>
            Alert.alert(
              'Bientôt disponible',
              'Tu pourras bientôt demander une archive de tes vidéos, messages et informations de compte.',
            )
          }
        />
      </SettingsSection>
    </SettingsScreen>
  )
}
