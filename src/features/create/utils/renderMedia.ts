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
  /** Renseigné pour permettre l'annulation depuis l'UI. */
  onSession?: (sessionId: number) => void
  /** Côté max de sortie. Sert au proxy d'aperçu (320) et aux tests. */
  maxSize?: number
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
  }

  const muted = video?.muted ?? false
  if (!trimmed && !muted && !needsRender({ ...input, overlayCount: media.overlay?.length ?? 0 })) {
    return { uri: media.uri, width: media.width ?? 0, height: media.height ?? 0 }
  }

  try {
    await ensureDir()
    const { chain, width, height } = buildFilterChain(input)
    const out = `${RENDER_DIR}video-${Date.now()}.mp4`
    const withOverlay = Boolean(options.overlayUri)
    const durationMs = Math.max(0, (trimEnd || media.duration || 0) - trimStart)

    const args = [
      '-y',
      /* -ss avant -i : seek rapide sur keyframe, puis découpe précise. */
      ...(trimStart > 0 ? ['-ss', (trimStart / 1000).toFixed(3)] : []),
      '-i', toPath(media.uri),
      ...(withOverlay ? ['-i', toPath(options.overlayUri as string)] : []),
      ...(durationMs > 0 && trimmed ? ['-t', (durationMs / 1000).toFixed(3)] : []),
      '-filter_complex', complexGraph(chain, width, height, withOverlay),
      '-map', '[out]',
      ...(muted ? ['-an'] : ['-map', '0:a?', '-c:a', 'aac', '-b:a', '128k']),
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
