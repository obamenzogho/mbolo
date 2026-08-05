/* soundService.test.ts — Mapping d'un document Firestore `sounds` vers SoundRecord.
   Firestore renvoie un Timestamp (pas un Date) : la conversion doit le gérer. */

import { mapSoundDocument } from '../soundService'

/* Le SDK Firestore est distribué en ESM : on l'isole du transform Jest.
   Babel remonte les jest.mock au-dessus des imports. */
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  runTransaction: jest.fn(),
  where: jest.fn(),
  increment: jest.fn(),
}))

jest.mock('@/lib/firebase', () => ({ db: {} }))

jest.mock('@/lib/sentry', () => ({ captureException: jest.fn() }))

describe('mapSoundDocument', () => {
  it('mappe les champs d’un document complet', () => {
    const sound = mapSoundDocument('sound-1', {
      title: 'Ambiance Libreville',
      artist: 'DJ Mbolo',
      audioURL: 'https://cdn.example/sound-1.mp3',
      durationMs: 30_000,
      coverURL: 'https://cdn.example/cover.jpg',
      usageCount: 12,
      status: 'active',
      createdAt: null,
    })

    expect(sound).toEqual({
      id: 'sound-1',
      title: 'Ambiance Libreville',
      artist: 'DJ Mbolo',
      audioURL: 'https://cdn.example/sound-1.mp3',
      durationMs: 30_000,
      coverURL: 'https://cdn.example/cover.jpg',
      usageCount: 12,
      createdAt: null,
      status: 'active',
    })
  })

  it('convertit un Timestamp Firestore en millisecondes', () => {
    const sound = mapSoundDocument('sound-2', {
      createdAt: { toMillis: () => 1_700_000_000_000 },
    })

    expect(sound.createdAt).toBe(1_700_000_000_000)
  })

  it('convertit une Date en millisecondes', () => {
    const date = new Date('2026-01-15T10:00:00.000Z')
    const sound = mapSoundDocument('sound-3', { createdAt: date })

    expect(sound.createdAt).toBe(date.getTime())
  })

  it('retourne null quand createdAt est absent ou illisible', () => {
    expect(mapSoundDocument('sound-4', {}).createdAt).toBeNull()
    expect(mapSoundDocument('sound-5', { createdAt: 'invalide' }).createdAt).toBeNull()
  })

  it('applique des valeurs de repli sûres sur un document partiel', () => {
    const sound = mapSoundDocument('sound-6', {})

    expect(sound).toEqual({
      id: 'sound-6',
      title: '',
      artist: '',
      audioURL: '',
      durationMs: 0,
      coverURL: undefined,
      usageCount: 0,
      createdAt: null,
      status: 'inactive',
    })
  })
})
