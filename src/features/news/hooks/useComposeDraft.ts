/* src/features/news/hooks/useComposeDraft.ts

   Brouillon local du composeur. Une publication en cours est du travail :
   fermer l'écran par erreur ne doit pas le détruire.

   Stocké en AsyncStorage, pas en Firestore : un brouillon est personnel,
   local, et n'a pas à consommer de quota ni à transiter sur le réseau.
   Un seul brouillon à la fois — Facebook fait de même, et un gestionnaire
   de brouillons multiples serait une fonctionnalité en soi. */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { captureException } from '@/lib/sentry'
import type { ComposeState } from './useComposeState'

const DRAFT_KEY = '@mbolo_compose_draft'

/** Au-delà, l'URI locale d'un média a de bonnes chances d'être révoquée. */
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Délai d'inactivité avant écriture : écrire à chaque frappe userait le disque. */
const AUTOSAVE_DELAY_MS = 800

interface StoredDraft {
  savedAt: number
  state: ComposeState
}

function report(error: unknown, context: string) {
  captureException(error instanceof Error ? error : new Error(String(error)), { context })
}

export async function readComposeDraft(): Promise<ComposeState | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY)
    if (!raw) return null

    const stored = JSON.parse(raw) as StoredDraft
    if (!stored?.state) return null

    if (Date.now() - stored.savedAt > DRAFT_MAX_AGE_MS) {
      await AsyncStorage.removeItem(DRAFT_KEY)
      return null
    }

    return stored.state
  } catch (error) {
    report(error, 'news.compose.readDraft')
    return null
  }
}

export async function clearComposeDraft(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY).catch((error) =>
    report(error, 'news.compose.clearDraft'),
  )
}

export async function writeComposeDraft(state: ComposeState): Promise<void> {
  const payload: StoredDraft = { savedAt: Date.now(), state }

  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload)).catch((error) =>
    report(error, 'news.compose.writeDraft'),
  )
}

interface UseComposeDraftOptions {
  /** État courant, écrit après une pause de saisie. */
  state: ComposeState
  /** Empreinte du contenu : ne rien écrire tant qu'elle ne bouge pas. */
  snapshot: string
  /** L'édition d'un post existant ne produit pas de brouillon. */
  enabled: boolean
  /** Vrai dès qu'il y a quelque chose à sauver. */
  hasContent: boolean
}

/**
 * Autosauvegarde différée + brouillon disponible à l'ouverture.
 * `pending` est le brouillon trouvé au démarrage, à proposer via une bannière ;
 * il n'est jamais appliqué d'office — l'utilisateur décide de le reprendre.
 */
export function useComposeDraft({
  state,
  snapshot,
  enabled,
  hasContent,
}: UseComposeDraftOptions) {
  const [pending, setPending] = useState<ComposeState | null>(null)
  const [checked, setChecked] = useState(false)

  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!enabled) {
      setChecked(true)
      return
    }

    let cancelled = false

    readComposeDraft().then((draft) => {
      if (cancelled) return
      setPending(draft)
      setChecked(true)
    })

    return () => {
      cancelled = true
    }
  }, [enabled])

  // L'autosauvegarde ne démarre qu'une fois le brouillon existant lu, sinon
  // le premier rendu (état vide) l'écraserait avant qu'on ait pu le proposer.
  useEffect(() => {
    if (!enabled || !checked) return

    // Un brouillon est proposé et l'écran est encore vide : ne rien écrire,
    // sinon l'état vide efface ce que la bannière propose de reprendre.
    if (pending && !hasContent) return

    if (!hasContent) {
      clearComposeDraft()
      return
    }

    const timer = setTimeout(() => {
      writeComposeDraft(stateRef.current)
    }, AUTOSAVE_DELAY_MS)

    return () => clearTimeout(timer)
  }, [enabled, checked, pending, hasContent, snapshot])

  /** L'utilisateur reprend le brouillon : on retire la bannière. */
  const consumePending = useCallback(() => {
    const draft = pending
    setPending(null)
    return draft
  }, [pending])

  /** L'utilisateur refuse le brouillon : on l'efface pour de bon. */
  const discardPending = useCallback(() => {
    setPending(null)
    clearComposeDraft()
  }, [])

  /** Écriture immédiate, à la fermeture de l'écran. */
  const saveNow = useCallback(async () => {
    if (!enabled) return
    await writeComposeDraft(stateRef.current)
  }, [enabled])

  return { pending, consumePending, discardPending, saveNow }
}
