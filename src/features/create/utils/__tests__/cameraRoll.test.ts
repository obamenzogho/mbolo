/* cameraRoll.test.ts — Sauvegarde dans la pellicule.
   Le contrat : jamais de throw (un échec ne bloque pas la capture),
   refus de permission → 'denied', succès → 'saved', et une seule demande
   de permission partagée entre les appels concurrents (rafale). */

import { Platform } from 'react-native'
import * as MediaLibrary from 'expo-media-library'

jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
}))
jest.mock('@/lib/sentry', () => ({ captureException: jest.fn() }))

import { captureException } from '@/lib/sentry'
import { saveMediaToLibrary } from '../cameraRoll'

const mockGetPermissions = MediaLibrary.getPermissionsAsync as jest.Mock
const mockRequestPermissions = MediaLibrary.requestPermissionsAsync as jest.Mock
const mockSaveToLibrary = MediaLibrary.saveToLibraryAsync as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockGetPermissions.mockResolvedValue({ granted: true })
  mockRequestPermissions.mockResolvedValue({ granted: true })
  mockSaveToLibrary.mockResolvedValue(undefined)
})

describe('saveMediaToLibrary', () => {
  it('sauvegarde sans redemander une permission déjà accordée', async () => {
    const result = await saveMediaToLibrary('file:///tmp/photo.jpg')

    expect(result).toBe('saved')
    expect(mockGetPermissions).toHaveBeenCalledTimes(1)
    expect(mockRequestPermissions).not.toHaveBeenCalled()
    expect(mockSaveToLibrary).toHaveBeenCalledWith('file:///tmp/photo.jpg')
  })

  it('demande la permission quand elle n’est pas encore accordée', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false })
    mockRequestPermissions.mockResolvedValue({ granted: true })

    const result = await saveMediaToLibrary('file:///tmp/photo.jpg')

    expect(result).toBe('saved')
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1)
  })

  it('retourne denied quand la permission est refusée, sans throw', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false })
    mockRequestPermissions.mockResolvedValue({ granted: false })

    const result = await saveMediaToLibrary('file:///tmp/photo.jpg')

    expect(result).toBe('denied')
    expect(mockSaveToLibrary).not.toHaveBeenCalled()
  })

  it('ne partage qu’une seule demande de permission pour les appels concurrents', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false })
    mockRequestPermissions.mockResolvedValue({ granted: true })

    const outcomes = await Promise.all([
      saveMediaToLibrary('file:///tmp/a.jpg'),
      saveMediaToLibrary('file:///tmp/b.jpg'),
      saveMediaToLibrary('file:///tmp/c.jpg'),
    ])

    expect(outcomes).toEqual(['saved', 'saved', 'saved'])
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1)
  })

  it('retourne failed et logge quand l’écriture disque échoue', async () => {
    mockSaveToLibrary.mockRejectedValue(new Error('disk full'))

    const result = await saveMediaToLibrary('file:///tmp/photo.jpg')

    expect(result).toBe('failed')
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: 'create.camera.saveToLibrary' }),
    )
  })

  it('refuse silencieusement sur le web', async () => {
    const originalOs = Platform.OS
    Object.defineProperty(Platform, 'OS', { get: () => 'web' })

    const result = await saveMediaToLibrary('file:///tmp/photo.jpg')

    expect(result).toBe('denied')
    expect(mockGetPermissions).not.toHaveBeenCalled()

    Object.defineProperty(Platform, 'OS', { get: () => originalOs })
  })
})
