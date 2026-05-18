import { FFmpegKit, FFmpegSession, FFprobeKit, FFprobeSession, FFmpeg } from 'ffmpeg-kit-react-native'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'

const CACHE_DIR = FileSystem.cacheDirectory || ''
const TEMP_DIR = `${CACHE_DIR}ffmpeg/`

async function ensureTempDir(): Promise<void> {
  const dir = await FileSystem.getInfoAsync(TEMP_DIR)
  if (!dir.exists) {
    await FileSystem.makeDirectoryAsync(TEMP_DIR, { intermediates: true })
  }
}

export async function initFFmpeg(): Promise<void> {
  await ensureTempDir()
}

export function getTempPath(filename: string): string {
  return `${TEMP_DIR}${filename}`
}

export async function cleanupTemp(): Promise<void> {
  try {
    const files = await FileSystem.readDirectoryAsync(TEMP_DIR)
    for (const file of files) {
      await FileSystem.deleteAsync(`${TEMP_DIR}${file}`, { idempotent: true })
    }
  } catch {}
}

export interface FFmpegResult {
  success: boolean
  output?: string
  error?: string
  returnCode?: number
}

async function runCommand(cmd: string, timeout = 300000): Promise<FFmpegResult> {
  try {
    const session = await FFmpegKit.execute(cmd)
    const returnCode = await session.getReturnCode()
    const output = await session.getOutput()
    if (returnCode?.isValueSuccess()) {
      return { success: true, output, returnCode: returnCode?.getValue() }
    } else {
      const logs = await session.getLogsAsString()
      return { success: false, error: logs || 'Command failed', returnCode: returnCode?.getValue() }
    }
  } catch (e: any) {
    return { success: false, error: e?.message || String(e) }
  }
}

export type VideoFilter =
  | 'grayscale'
  | 'warm'
  | 'cool'
  | 'vintage'
  | 'bright'
  | 'sepia'
  | 'contrast'
  | 'saturate'

const FILTER_MAP: Record<VideoFilter | string, string> = {
  grayscale: 'colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3',
  warm: 'colorbalance=rs=0.1:gs=0.05:bs=-0.1',
  cool: 'colorbalance=rs=-0.1:gs=0:bs=0.1',
  vintage: 'curves=vintage',
  bright: 'eq=brightness=0.1:saturation=1.5',
  sepia: 'colorbalance=rs=0.2:gs=0.1:bs=-0.1',
  contrast: 'eq=contrast=1.3:saturation=1.2',
  saturate: 'eq=saturation=1.7',
}

export async function trimVideo(
  inputUri: string,
  startSec: number,
  endSec: number,
  outputPath: string
): Promise<FFmpegResult> {
  const duration = endSec - startSec
  const cmd = `-i "${inputUri}" -ss ${startSec} -t ${duration} -c:v copy -c:a copy "${outputPath}"`
  return runCommand(cmd)
}

export async function addMusic(
  videoUri: string,
  musicUri: string,
  outputPath: string,
  videoVolume = 0.5,
  musicVolume = 0.8
): Promise<FFmpegResult> {
  const cmd = `-i "${videoUri}" -i "${musicUri}" -filter_complex "[0:a]volume=${videoVolume}[a1];[1:a]volume=${musicVolume}[a2];[a1][a2]amix=inputs=2:duration=shortest[aout]" -map 0:v -map "[aout]" -shortest "${outputPath}"`
  return runCommand(cmd)
}

export async function changeSpeed(
  inputUri: string,
  speed: number,
  outputPath: string
): Promise<FFmpegResult> {
  const videoPts = 1 / speed
  const audioTempo = speed
  const cmd = `-i "${inputUri}" -filter_complex "[0:v]setpts=${videoPts}*PTS[v];[0:a]atempo=${audioTempo}[a]" -map "[v]" -map "[a]" "${outputPath}"`
  return runCommand(cmd)
}

export async function mergeClips(
  clipUris: string[],
  outputPath: string
): Promise<FFmpegResult> {
  if (clipUris.length === 0) {
    return { success: false, error: 'No clips provided' }
  }

  await ensureTempDir()
  const listPath = `${TEMP_DIR}clips.txt`

  const listContent = clipUris.map(uri => `file '${uri}'`).join('\n')
  await FileSystem.writeAsStringAsync(listPath, listContent)

  const cmd = `-f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`
  const result = await runCommand(cmd)

  try {
    await FileSystem.deleteAsync(listPath, { idempotent: true })
  } catch {}

  return result
}

export async function applyVideoFilter(
  inputUri: string,
  filter: VideoFilter,
  outputPath: string
): Promise<FFmpegResult> {
  const vf = FILTER_MAP[filter] || ''
  if (!vf) return { success: false, error: `Unknown filter: ${filter}` }
  const cmd = `-i "${inputUri}" -vf "${vf}" -c:a copy "${outputPath}"`
  return runCommand(cmd)
}

export async function applyCustomFilter(
  inputUri: string,
  videoFilter: string,
  outputPath: string
): Promise<FFmpegResult> {
  const cmd = `-i "${inputUri}" -vf "${videoFilter}" -c:a copy "${outputPath}"`
  return runCommand(cmd)
}

export async function compressVideo(
  inputUri: string,
  outputPath: string,
  quality: 'high' | 'medium' | 'low' = 'medium'
): Promise<FFmpegResult> {
  const presets = {
    high: { crf: '18', preset: 'slow', codec: 'libx264' },
    medium: { crf: '28', preset: 'medium', codec: 'libx264' },
    low: { crf: '35', preset: 'fast', codec: 'libx264' },
  }
  const { crf, preset, codec } = presets[quality]
  const cmd = `-i "${inputUri}" -vcodec ${codec} -crf ${crf} -preset ${preset} -c:a copy "${outputPath}"`
  return runCommand(cmd)
}

export async function extractAudio(
  videoUri: string,
  outputPath: string
): Promise<FFmpegResult> {
  const cmd = `-i "${videoUri}" -vn -acodec copy "${outputPath}"`
  return runCommand(cmd)
}

export interface VideoInfo {
  duration: number
  width: number
  height: number
  fps: number
  bitrate: number
  codec: string
  size: number
}

export async function getVideoInfo(uri: string): Promise<VideoInfo | null> {
  try {
    const cmd = `-v quiet -print_format json -show_streams -show_format "${uri}"`
    const session = await FFprobeKit.execute(cmd)
    const output = await session.getOutput()
    if (!output) return null

    const data = JSON.parse(output)
    const videoStream = data.streams?.find((s: any) => s.codec_type === 'video')
    const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio')
    const format = data.format

    return {
      duration: parseFloat(format?.duration || '0'),
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      fps: videoStream ? eval(videoStream.r_frame_rate || '0') : 0,
      bitrate: parseInt(format?.bit_rate || '0', 10),
      codec: videoStream?.codec_name || 'unknown',
      size: parseInt(format?.size || '0', 10),
    }
  } catch {
    return null
  }
}

export async function addVoiceover(
  videoUri: string,
  voiceUri: string,
  outputPath: string,
  videoVolume = 0.3
): Promise<FFmpegResult> {
  const cmd = `-i "${videoUri}" -i "${voiceUri}" -filter_complex "[0:a]volume=${videoVolume}[a1];[1:a]volume=1[a2];[a1][a2]amix=inputs=2:duration=first[aout]" -map 0:v -map "[aout]" "${outputPath}"`
  return runCommand(cmd)
}

export async function flipVideo(
  inputUri: string,
  direction: 'horizontal' | 'vertical',
  outputPath: string
): Promise<FFmpegResult> {
  const filter = direction === 'horizontal' ? 'hflip' : 'vflip'
  const cmd = `-i "${inputUri}" -vf "${filter}" -c:a copy "${outputPath}"`
  return runCommand(cmd)
}

export async function rotateVideo(
  inputUri: string,
  angle: number,
  outputPath: string
): Promise<FFmpegResult> {
  const cmd = `-i "${inputUri}" -vf "rotate=${angle * Math.PI / 180}" -c:a copy "${outputPath}"`
  return runCommand(cmd)
}

export async function extractThumbnail(
  inputUri: string,
  timeSec: number,
  outputPath: string
): Promise<FFmpegResult> {
  const cmd = `-i "${inputUri}" -ss ${timeSec} -vframes 1 -q:v 2 "${outputPath}"`
  return runCommand(cmd)
}

export async function convertToMp4(
  inputUri: string,
  outputPath: string
): Promise<FFmpegResult> {
  const cmd = `-i "${inputUri}" -c:v libx264 -c:a aac -strict experimental "${outputPath}"`
  return runCommand(cmd)
}

export async function resizeVideo(
  inputUri: string,
  width: number,
  height: number,
  outputPath: string
): Promise<FFmpegResult> {
  const cmd = `-i "${inputUri}" -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2" -c:a copy "${outputPath}"`
  return runCommand(cmd)
}

export async function applyTrimAndFilter(
  inputUri: string,
  startSec: number,
  endSec: number,
  videoFilter: string,
  outputPath: string
): Promise<FFmpegResult> {
  const duration = endSec - startSec
  let cmd = `-i "${inputUri}" -ss ${startSec} -t ${duration}`
  if (videoFilter) {
    cmd += ` -vf "${videoFilter}"`
  }
  cmd += ` -c:a copy "${outputPath}"`
  return runCommand(cmd)
}

export async function muteVideo(
  inputUri: string,
  outputPath: string
): Promise<FFmpegResult> {
  const cmd = `-i "${inputUri}" -an -c:v copy "${outputPath}"`
  return runCommand(cmd)
}

export async function addWaterMark(
  inputUri: string,
  watermarkUri: string,
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
  outputPath: string
): Promise<FFmpegResult> {
  const positions: Record<string, string> = {
    'top-left': 'overlay=10:10',
    'top-right': 'overlay=main_w-overlay_w-10:10',
    'bottom-left': 'overlay=10:main_h-overlay_h-10',
    'bottom-right': 'overlay=main_w-overlay_w-10:main_h-overlay_h-10',
  }
  const filter = positions[position] || positions['bottom-right']
  const cmd = `-i "${inputUri}" -i "${watermarkUri}" -filter_complex "${filter}" -c:a copy "${outputPath}"`
  return runCommand(cmd)
}

export function cancelAllOperations(): void {
  FFmpegKit.cancel()
}

export function cancelOperation(sessionId: string): void {
  FFmpegKit.cancel(sessionId)
}