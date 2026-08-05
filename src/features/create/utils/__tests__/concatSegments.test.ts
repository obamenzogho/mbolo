/* concatSegments.test.ts — Construction des arguments FFmpeg de concaténation.
   Un segment enregistré sans permission micro n'a aucune piste audio : mapper
   [i:a:0] dessus ferait échouer toute la concaténation. */

import { buildConcatArguments } from '../concatSegments'

/* ffmpeg-kit et expo-file-system sont natifs : hors périmètre du test unitaire.
   Babel remonte les jest.mock au-dessus des imports. */
jest.mock('ffmpeg-kit-react-native', () => ({
  FFmpegKit: { executeWithArgumentsAsync: jest.fn() },
  FFprobeKit: { getMediaInformationAsync: jest.fn() },
  ReturnCode: { isSuccess: jest.fn() },
}))

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}))

jest.mock('@/lib/sentry', () => ({ captureException: jest.fn() }))

const OUT = 'file:///tmp/out.mp4'

function filterOf(args: string[]): string {
  return args[args.indexOf('-filter_complex') + 1]
}

describe('buildConcatArguments', () => {
  it('mappe les pistes natives quand tous les segments ont du son', () => {
    const args = buildConcatArguments(
      [
        { uri: 'file:///a.mp4', durationMs: 3000, hasAudio: true },
        { uri: 'file:///b.mp4', durationMs: 2000, hasAudio: true },
      ],
      OUT,
    )

    expect(filterOf(args)).toBe('[0:v:0][0:a:0][1:v:0][1:a:0]concat=n=2:v=1:a=1[outv][outa]')
    expect(args).not.toContain('anullsrc=r=44100:cl=stereo')
  })

  it('retire le préfixe file:// des chemins', () => {
    const args = buildConcatArguments(
      [{ uri: 'file:///a.mp4', durationMs: 1000, hasAudio: true }],
      OUT,
    )

    expect(args).toContain('/a.mp4')
    expect(args[args.length - 1]).toBe('/tmp/out.mp4')
  })

  it('injecte un silence pour un segment sans piste audio', () => {
    const args = buildConcatArguments(
      [{ uri: 'file:///a.mp4', durationMs: 2500, hasAudio: false }],
      OUT,
    )

    expect(args).toContain('lavfi')
    expect(args).toContain('anullsrc=r=44100:cl=stereo')
    expect(args[args.indexOf('-t') + 1]).toBe('2.5')
    expect(filterOf(args)).toBe('[0:v:0][1:a:0]concat=n=1:v=1:a=1[outv][outa]')
  })

  it('n’injecte du silence que pour les segments muets', () => {
    const args = buildConcatArguments(
      [
        { uri: 'file:///a.mp4', durationMs: 1000, hasAudio: true },
        { uri: 'file:///b.mp4', durationMs: 2000, hasAudio: false },
        { uri: 'file:///c.mp4', durationMs: 3000, hasAudio: true },
      ],
      OUT,
    )

    expect(filterOf(args)).toBe(
      '[0:v:0][0:a:0][1:v:0][3:a:0][2:v:0][2:a:0]concat=n=3:v=1:a=1[outv][outa]',
    )
    expect(args.filter((arg) => arg === 'anullsrc=r=44100:cl=stereo')).toHaveLength(1)
  })
})
