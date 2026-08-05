/* renderMedia.test.ts — Arguments audio du rendu vidéo.

   Un son de la bibliothèque remplace l'audio d'origine (comportement TikTok
   par défaut) et boucle s'il est plus court que la vidéo. */

import { buildAudioArguments } from '../renderMedia'

/* ffmpeg-kit et expo-file-system sont natifs : hors périmètre du test unitaire.
   Babel remonte les jest.mock au-dessus des imports. */
jest.mock('ffmpeg-kit-react-native', () => ({
  FFmpegKit: { executeWithArgumentsAsync: jest.fn(), cancel: jest.fn() },
  FFmpegKitConfig: {},
  ReturnCode: { isSuccess: jest.fn() },
}))

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
}))

jest.mock('@/lib/sentry', () => ({ captureException: jest.fn() }))

describe('buildAudioArguments', () => {
  describe('sans son de bibliothèque', () => {
    it('conserve l’audio d’origine', () => {
      const { inputs, output } = buildAudioArguments({ soundInputIndex: 1 })

      expect(inputs).toEqual([])
      expect(output).toEqual(['-map', '0:a?', '-c:a', 'aac', '-b:a', '128k'])
    })

    it('applique atempo quand la vitesse de capture change', () => {
      const { output } = buildAudioArguments({ soundInputIndex: 1, speed: 2 })

      expect(output).toEqual([
        '-map', '0:a?',
        '-af', 'atempo=2',
        '-c:a', 'aac', '-b:a', '128k',
      ])
    })

    it('coupe toute piste audio quand la vidéo est muette', () => {
      const { inputs, output } = buildAudioArguments({
        soundInputIndex: 1,
        muted: true,
      })

      expect(inputs).toEqual([])
      expect(output).toEqual(['-an'])
    })
  })

  describe('avec un son de bibliothèque', () => {
    it('remplace l’audio d’origine et boucle le son', () => {
      const { inputs, output } = buildAudioArguments({
        soundInputIndex: 1,
        soundPath: '/cache/sound.mp3',
      })

      expect(inputs).toEqual(['-stream_loop', '-1', '-i', '/cache/sound.mp3'])
      expect(output).toEqual(['-map', '1:a', '-c:a', 'aac', '-b:a', '128k'])
    })

    it('mappe le son sur son index réel quand un overlay occupe une entrée', () => {
      const { output } = buildAudioArguments({
        soundInputIndex: 2,
        soundPath: '/cache/sound.mp3',
      })

      expect(output).toContain('2:a')
    })

    it('ignore la vitesse de capture : la musique garde son tempo', () => {
      const { output } = buildAudioArguments({
        soundInputIndex: 1,
        soundPath: '/cache/sound.mp3',
        speed: 2,
      })

      expect(output).not.toContain('-af')
    })

    it('joue le son même si l’audio d’origine est coupé', () => {
      const { inputs, output } = buildAudioArguments({
        soundInputIndex: 1,
        soundPath: '/cache/sound.mp3',
        muted: true,
      })

      expect(inputs).toEqual(['-stream_loop', '-1', '-i', '/cache/sound.mp3'])
      expect(output).toEqual(['-map', '1:a', '-c:a', 'aac', '-b:a', '128k'])
    })

    it('retire le préfixe file:// du chemin du son', () => {
      const { inputs } = buildAudioArguments({
        soundInputIndex: 1,
        soundPath: 'file:///cache/sound.mp3',
      })

      expect(inputs).toContain('/cache/sound.mp3')
    })
  })
})
