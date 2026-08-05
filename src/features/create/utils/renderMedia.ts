/* src/features/create/utils/renderMedia.ts

   Rendu final d'un média édité, avant upload Cloudinary. Un seul moteur
   (FFmpeg) pour la photo et la vidéo : la chaîne de filtres est identique,
   seuls les codecs de sortie changent. Remplace applyEdit.ts. */

import { FFmpegKit, FFmpegKitConfig, ReturnCode } from 'ffmpeg-kit-react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { captureException } from '@/lib/sentry'
import type { SelectedMedia } from '@/features/news/hooks/useComposeState'
import { buildFilterChain, needsRender } from './filterGraph'

const RENDER_DIR = `${FileSystem.cacheDirectory}mbolo-render/`

/** FFmpeg veut un chemin POSIX, pas une URI file://. */
const toPath = (uri: string) => uri.replace(/^file:\/\//, '')

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(RENDER_DIR)
  if (!info.exists) await FileSystem.makeDirectoryAsync(RENDER_DIR, { intermediates: true })
}

export interface RenderOptions {
  /** PNG transparent des textes/stickers/dessins, à la taille de sortie. */
  overlayUri?: string | null
  onProgress?: (ratio: number) => void
  /** Renseigné pour permettre l'annuation depuis l'UI. */
  onSession?: (sessionId: number) => void
  /** Côté max de sortie. Sert au proxy d'aperçu (320) et aux tests. */
  maxSize?: number
  /** Mode de géométrie : 'all' = tout, 'straighten' = straighten + couleur (proxy crop tab). */
  geometryMode?: 'all' | 'color'
  /** Piste locale de la bibliothèque : remplace l'audio d'origine. */
  soundUri?: string | null
}

export interface RenderResult {
  uri: string
  width: number
  height: number
}

export class RenderMediaError extends Error {
  constructor(message = 'Le rendu du média a échoué') {
    super(message)
    this.name = 'RenderMediaError'
  }
}

/** Exécute FFmpeg et résout avec le code de retour. */
function run(
  args: string[],
  durationMs: number,
  options: RenderOptions,
): Promise<boolean> {
  return new Promise((resolve) => {
    FFmpegKit.executeWithArgumentsAsync(
      args,
      async (session) => {
        const rc = await session.getReturnCode()
        if (!ReturnCode.isSuccess(rc)) {
          const logs = await session.getAllLogsAsString()
          console.warn('[renderMedia] FFmpeg a échoué:', logs?.slice(-800))
        }
        resolve(ReturnCode.isSuccess(rc))
      },
      undefined,
      (stats) => {
        if (durationMs > 0 && options.onProgress) {
          options.onProgress(Math.min(1, stats.getTime() / durationMs))
        }
      },
    ).then((session) => options.onSession?.(session.getSessionId()))
  })
}

/** Bloc filter_complex commun : chaîne couleur + composition de l'overlay. */
function complexGraph(chain: string, w: number, h: number, withOverlay: boolean): string {
  if (!withOverlay) return `[0:v]${chain}[out]`
  return `[0:v]${chain}[base];[1:v]scale=${w}:${h}[ov];[base][ov]overlay=0:0:format=auto[out]`
}

/* `atempo` n'accepte qu'un facteur entre 0.5 et 2 : au-delà, on cascade
   plusieurs passes dont le produit vaut la vitesse demandée. */
function atempoChain(speed: number): string {
  const stages: number[] = []
  let remaining = speed
  while (remaining > 2) { stages.push(2); remaining /= 2 }
  while (remaining < 0.5) { stages.push(0.5); remaining /= 0.5 }
  stages.push(remaining)
  return stages.map((s) => `atempo=${Math.round(s * 1000) / 1000}`).join(',')
}

interface AudioArgumentsInput {
  /** Position de la piste de bibliothèque parmi les `-i` (après overlay éventuel). */
  soundInputIndex: number
  soundPath?: string | null
  muted?: boolean
  speed?: number
}

/* Un son de bibliothèque remplace l'audio d'origine : il garde son tempo (pas
   d'atempo) et boucle si la vidéo est plus longue, `-shortest` coupant l'excédent. */
export function buildAudioArguments({
  soundInputIndex,
  soundPath,
  muted = false,
  speed = 1,
}: AudioArgumentsInput): { inputs: string[]; output: string[] } {
  if (soundPath) {
    return {
      inputs: ['-stream_loop', '-1', '-i', toPath(soundPath)],
      output: ['-map', `${soundInputIndex}:a`, '-c:a', 'aac', '-b:a', '128k'],
    }
  }

  if (muted) return { inputs: [], output: ['-an'] }

  return {
    inputs: [],
    output: [
      '-map', '0:a?',
      ...(speed !== 1 ? ['-af', atempoChain(speed)] : []),
      '-c:a', 'aac', '-b:a', '128k',
    ],
  }
}

/* ── Photo ────────────────────────────────────────────────────────── */

export async function renderPhoto(
  media: SelectedMedia,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const input = {
    width: media.width ?? 1080,
    height: media.height ?? 1080,
    crop: media.crop,
    cropTransform: media.cropTransform,
    filterId: media.filterId,
    filterIntensity: media.filterIntensity,
    effectId: media.effectId,
    effectIntensity: media.effectIntensity,
    adjustments: media.adjustments,
    maxSize: options.maxSize ?? 1440,
    geometryMode: options.geometryMode,
  }

  if (!needsRender({ ...input, overlayCount: media.overlay?.length ?? 0 })) {
    return { uri: media.uri, width: media.width ?? 0, height: media.height ?? 0 }
  }

  try {
    await ensureDir()
    const { chain, width, height } = buildFilterChain(input)
    const out = `${RENDER_DIR}photo-${Date.now()}.jpg`
    const withOverlay = Boolean(options.overlayUri)

    const args = [
      '-y',
      '-i', toPath(media.uri),
      ...(withOverlay ? ['-i', toPath(options.overlayUri as string)] : []),
      '-filter_complex', complexGraph(chain, width, height, withOverlay),
      '-map', '[out]',
      '-frames:v', '1',
      '-q:v', '2',
      toPath(out),
    ]

    const ok = await run(args, 0, options)
    options.onProgress?.(1)
    if (!ok) {
      throw new RenderMediaError('Impossible de rendre la photo')
    }
    return { uri: out, width, height }
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'create.renderPhoto',
    })
    throw new RenderMediaError('Erreur inattendue lors du rendu photo')
  }
}

/* ── Vidéo ────────────────────────────────────────────────────────── */

export async function renderVideo(
  media: SelectedMedia,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const video = media.video
  const trimStart = Math.max(0, video?.trimStart ?? 0)
  const trimEnd = video?.trimEnd ?? media.duration ?? 0
  const trimmed = trimStart > 0 || (trimEnd > 0 && trimEnd < (media.duration ?? 0))

  const input = {
    width: media.width ?? 1080,
    height: media.height ?? 1920,
    crop: media.crop,
    cropTransform: media.cropTransform,
    filterId: media.filterId,
    filterIntensity: media.filterIntensity,
    effectId: media.effectId,
    effectIntensity: media.effectIntensity,
    adjustments: media.adjustments,
    maxSize: options.maxSize ?? 1080,
    geometryMode: options.geometryMode,
  }

  const muted = video?.muted ?? false
  /* Vitesse capturée en caméra (0.3x → 3x). 1 = temps réel. */
  const speed = video?.speed && video.speed > 0 ? video.speed : 1
  const respeeded = speed !== 1
  const soundUri = options.soundUri ?? null
  if (
    !trimmed &&
    !muted &&
    !respeeded &&
    !soundUri &&
    !needsRender({ ...input, overlayCount: media.overlay?.length ?? 0 })
  ) {
    return { uri: media.uri, width: media.width ?? 0, height: media.height ?? 0 }
  }

  try {
    await ensureDir()
    const { chain, width, height } = buildFilterChain(input)
    const out = `${RENDER_DIR}video-${Date.now()}.mp4`
    const withOverlay = Boolean(options.overlayUri)
    const sourceMs = Math.max(0, (trimEnd || media.duration || 0) - trimStart)
    /* La progression FFmpeg est mesurée sur le flux de sortie : accéléré,
       il dure moins longtemps que la source. */
    const durationMs = sourceMs / speed
    /* `setpts` change la cadence vidéo, `atempo` celle du son : les deux
       doivent porter le même facteur sous peine de désynchronisation. */
    const videoChain = respeeded
      ? `${chain},setpts=${Math.round((1 / speed) * 1000) / 1000}*PTS`
      : chain

    const audio = buildAudioArguments({
      soundInputIndex: withOverlay ? 2 : 1,
      soundPath: soundUri,
      muted,
      speed,
    })

    const args = [
      '-y',
      /* -ss avant -i : seek rapide sur keyframe, puis découpe précise. */
      ...(trimStart > 0 ? ['-ss', (trimStart / 1000).toFixed(3)] : []),
      '-i', toPath(media.uri),
      ...(withOverlay ? ['-i', toPath(options.overlayUri as string)] : []),
      ...audio.inputs,
      ...(sourceMs > 0 && trimmed ? ['-t', (sourceMs / 1000).toFixed(3)] : []),
      '-filter_complex', complexGraph(videoChain, width, height, withOverlay),
      '-map', '[out]',
      ...audio.output,
      /* Le son bouclé est infini : sans -shortest, FFmpeg n'arrêterait jamais. */
      ...(soundUri ? ['-shortest'] : []),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-profile:v', 'high',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      toPath(out),
    ]

    const ok = await run(args, durationMs, options)
    options.onProgress?.(1)
    if (!ok) {
      throw new RenderMediaError('Impossible de rendre la vidéo')
    }
    return { uri: out, width, height }
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'create.renderVideo',
    })
    throw new RenderMediaError('Erreur inattendue lors du rendu vidéo')
  }
}

export function renderMedia(media: SelectedMedia, options: RenderOptions = {}) {
  return media.type === 'video' ? renderVideo(media, options) : renderPhoto(media, options)
}

export function cancelRender(sessionId?: number): void {
  if (sessionId) FFmpegKit.cancel(sessionId)
  else FFmpegKit.cancel()
}

/** À appeler après publication ou abandon : le cache de rendu grossit vite. */
export async function clearRenderCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(RENDER_DIR, { idempotent: true })
  } catch (error) {
    console.warn('[renderMedia] Nettoyage du cache impossible:', error)
  }
}
