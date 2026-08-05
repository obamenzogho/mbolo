/* useCameraPreferences.test.ts — Persistance des préférences caméra.
   Le contrat : parse strict (clés invalides → défauts, jamais de throw),
   chargement asynchrone au montage, écriture uniquement après chargement. */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, renderHook, waitFor } from '@testing-library/react-native'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
jest.mock('@/lib/sentry', () => ({ captureException: jest.fn() }))

import {
  CAMERA_PREFERENCES_KEY,
  DEFAULT_CAMERA_PREFERENCES,
  parseCameraPreferences,
  useCameraPreferences,
} from '../useCameraPreferences'

beforeEach(() => {
  AsyncStorage.clear()
})

describe('parseCameraPreferences', () => {
  it('retourne les défauts quand rien n’est stocké', () => {
    expect(parseCameraPreferences(null)).toEqual(DEFAULT_CAMERA_PREFERENCES)
  })

  it('ignore un JSON invalide sans throw', () => {
    expect(parseCameraPreferences('{pas du json')).toEqual(DEFAULT_CAMERA_PREFERENCES)
    expect(parseCameraPreferences('"une chaine"')).toEqual(DEFAULT_CAMERA_PREFERENCES)
  })

  it('comble les clés manquantes par les défauts', () => {
    const parsed = parseCameraPreferences(JSON.stringify({ showGrid: true }))

    expect(parsed.showGrid).toBe(true)
    expect(parsed.mirrorSelfie).toBe(DEFAULT_CAMERA_PREFERENCES.mirrorSelfie)
    expect(parsed.videoQuality).toBe(DEFAULT_CAMERA_PREFERENCES.videoQuality)
  })

  it('remplace une valeur invalide par le défaut', () => {
    const parsed = parseCameraPreferences(
      JSON.stringify({ videoQuality: '8k', saveToLibrary: 'oui' }),
    )

    expect(parsed.videoQuality).toBe(DEFAULT_CAMERA_PREFERENCES.videoQuality)
    expect(parsed.saveToLibrary).toBe(false)
  })
})

describe('useCameraPreferences', () => {
  it('applique les préférences chargées depuis le stockage', async () => {
    await AsyncStorage.setItem(
      CAMERA_PREFERENCES_KEY,
      JSON.stringify({ showGrid: true, mirrorSelfie: false }),
    )

    const { result } = await renderHook(() => useCameraPreferences())

    await waitFor(() => expect(result.current.preferences.showGrid).toBe(true))
    expect(result.current.preferences.mirrorSelfie).toBe(false)
    expect(result.current.preferences.videoQuality).toBe('1080p')
  })

  it('persiste chaque mise à jour dans le stockage', async () => {
    const { result } = await renderHook(() => useCameraPreferences())

    await act(async () => {
      result.current.updatePreferences({ saveToLibrary: true })
    })

    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(CAMERA_PREFERENCES_KEY)
      expect(raw).not.toBeNull()
    })
    const raw = await AsyncStorage.getItem(CAMERA_PREFERENCES_KEY)
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ saveToLibrary: true })
  })

  it('tombe sur les défauts quand le stockage contient des valeurs invalides', async () => {
    await AsyncStorage.setItem(
      CAMERA_PREFERENCES_KEY,
      JSON.stringify({ videoQuality: '8k', mirrorSelfie: 'oui' }),
    )

    const { result } = await renderHook(() => useCameraPreferences())

    await waitFor(() => expect(result.current.preferences.videoQuality).toBe('1080p'))
    expect(result.current.preferences.mirrorSelfie).toBe(true)
  })
})
