import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { captureException } from '@/lib/sentry'
import type { RecordingSegment } from '../types/editing'

const CONCAT_DIR = `${FileSystem.cacheDirectory}mbolo-segments/`
const SILENCE_SOURCE = 'anullsrc=r=44100:cl=stereo'

const toPath = (uri: string): string => uri.replace(/^file:\/\//, '')

export function buildConcatArguments(
  segments: readonly RecordingSegment[],
  outputPath: string,
): string[] {
  const inputs = segments.flatMap(({ uri }) => ['-i', toPath(uri)])
  const silenceInputs: string[] = []
  let nextInputIndex = segments.length

  /* Un segment muet ne peut pas fournir [i:a:0] : on lui adjoint un silence
     de même durée, sinon FFmpeg abandonne toute la concaténation. */
  const streams = segments
    .map((segment, index) => {
      if (segment.hasAudio !== false) return `[${index}:v:0][${index}:a:0]`

      silenceInputs.push(
        '-f', 'lavfi',
        '-t', String(segment.durationMs / 1000),
        '-i', SILENCE_SOURCE,
      )
      return `[${index}:v:0][${nextInputIndex++}:a:0]`
    })
    .join('')

  const filter = `${streams}concat=n=${segments.length}:v=1:a=1[outv][outa]`

  return [
    '-y',
    ...inputs,
    ...silenceInputs,
    '-filter_complex', filter,
    '-map', '[outv]',
    '-map', '[outa]',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    toPath(outputPath),
  ]
}

export class ConcatSegmentsError extends Error {
  constructor(message = 'Impossible de réunir les segments vidéo') {
    super(message)
    this.name = 'ConcatSegmentsError'
  }
}

async function ensureDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CONCAT_DIR)
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CONCAT_DIR, { intermediates: true })
  }
}

export async function concatSegments(
  segments: readonly RecordingSegment[],
): Promise<string> {
  if (segments.length === 0) throw new ConcatSegmentsError('Aucun segment vidéo')
  if (segments.length === 1) return segments[0].uri

  try {
    await ensureDirectory()
    const outputPath = `${CONCAT_DIR}video-${Date.now()}.mp4`
    const session = await FFmpegKit.executeWithArgumentsAsync(
      buildConcatArguments(segments, outputPath),
    )
    const returnCode = await session.getReturnCode()
    if (!ReturnCode.isSuccess(returnCode)) {
      throw new ConcatSegmentsError()
    }
    return outputPath
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'create.concatSegments',
      segmentCount: segments.length,
    })
    if (error instanceof ConcatSegmentsError) throw error
    throw new ConcatSegmentsError()
  }
}
