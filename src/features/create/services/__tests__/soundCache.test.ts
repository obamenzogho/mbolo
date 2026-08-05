/* soundCache.test.ts — Nom de fichier local d'une piste de la bibliothèque.
   Le cache est adressé par soundId : deux publications avec le même son ne
   retéléchargent pas, et une URL malicieuse ne peut pas sortir du dossier. */

import { buildSoundCachePath, SOUND_CACHE_DIR } from '../soundCache'

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
}))

jest.mock('@/lib/sentry', () => ({ captureException: jest.fn() }))

describe('buildSoundCachePath', () => {
  it('nomme le fichier d’après le soundId et l’extension de l’URL', () => {
    const path = buildSoundCachePath('sound-1', 'https://cdn.example/track.mp3')

    expect(path).toBe(`${SOUND_CACHE_DIR}sound-1.mp3`)
  })

  it('conserve l’extension m4a', () => {
    const path = buildSoundCachePath('sound-2', 'https://cdn.example/track.m4a')

    expect(path).toBe(`${SOUND_CACHE_DIR}sound-2.m4a`)
  })

  it('ignore la query string pour déduire l’extension', () => {
    const path = buildSoundCachePath('sound-3', 'https://cdn.example/t.mp3?token=abc')

    expect(path).toBe(`${SOUND_CACHE_DIR}sound-3.mp3`)
  })

  it('retombe sur .mp3 quand l’URL n’a pas d’extension connue', () => {
    expect(buildSoundCachePath('sound-4', 'https://cdn.example/stream')).toBe(
      `${SOUND_CACHE_DIR}sound-4.mp3`,
    )
    expect(buildSoundCachePath('sound-5', 'https://cdn.example/f.exe')).toBe(
      `${SOUND_CACHE_DIR}sound-5.mp3`,
    )
  })

  it('neutralise un soundId qui tenterait de remonter l’arborescence', () => {
    const path = buildSoundCachePath('../../etc/passwd', 'https://cdn.example/a.mp3')

    expect(path).toBe(`${SOUND_CACHE_DIR}etcpasswd.mp3`)
    expect(path).not.toContain('..')
  })

  it('neutralise les séparateurs et espaces d’un soundId inattendu', () => {
    const path = buildSoundCachePath('a b/c', 'https://cdn.example/a.mp3')

    expect(path).toBe(`${SOUND_CACHE_DIR}abc.mp3`)
  })
})
