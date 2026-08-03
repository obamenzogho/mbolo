/* src/features/create/utils/captureOverlay.ts

   Capture la couche texte / sticker / dessin en PNG transparent, aux
   dimensions exactes du rendu. FFmpeg s'occupe ensuite de la composition,
   photo et vidéo confondues. */

import { captureRef } from 'react-native-view-shot'
import { captureException } from '@/lib/sentry'
import type { OverlayEl } from '../types/editing'

export async function captureOverlay(
  ref: React.RefObject<unknown>,
  size: { width: number; height: number },
  overlay: OverlayEl[] | undefined,
): Promise<string | null> {
  if (!overlay || overlay.length === 0 || !ref.current) return null
  try {
    /* result:'tmpfile' → chemin disque, directement consommable par FFmpeg.
       La vue capturée NE DOIT PAS avoir de backgroundColor, sinon l'alpha
       est perdue et l'overlay masque toute l'image. */
    return await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: size.width,
      height: size.height,
    })
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'create.captureOverlay',
    })
    return null
  }
}
