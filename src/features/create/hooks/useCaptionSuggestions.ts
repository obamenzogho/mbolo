/* useCaptionSuggestions.ts — Suggestions hashtags et mentions en temps réel.

   Détecte le mot en cours de saisie (après # ou @), effectue une recherche
   debounce via Typesense, et fournit une fonction d'insertion qui complète
   le texte au bon endroit.

   Coût : 1 lecture Typesense par frappe (debounce 300ms), max 6 résultats.
   Pas de snapshot Firestore, pas de coût Firestore. */

import { useState, useCallback, useRef, useEffect } from 'react'
import { searchHashtags, searchUsers } from '@/services/searchService'
import type { HashtagResult, UserResult } from '@/services/searchService'

const DEBOUNCE_MS = 300
const MIN_CHARS = 1
const MAX_SUGGESTIONS = 6

type SuggestionKind = 'hashtag' | 'mention' | null

interface CaptionSuggestionsState {
  /** Type de suggestion actif (null = rien). */
  kind: SuggestionKind
  /** Texte brut après le # ou @ (pour filtrer en local). */
  query: string
  /** Index de début du mot en cours dans le texte complet. */
  startIndex: number
}

export interface CaptionSuggestions {
  /** Type de suggestion actif. */
  kind: SuggestionKind
  /** Requête en cours. */
  query: string
  /** Résultats hashtags (triés par popularité). */
  hashtags: HashtagResult[]
  /** Résultats utilisateurs. */
  users: UserResult[]
  /** En cours de chargement. */
  loading: boolean
  /** Détecte le trigger (# ou @) à partir du texte et de la position du curseur. */
  detect: (text: string, selectionEnd: number) => void
  /** Insère un hashtag complet dans le texte. */
  insertHashtag: (tag: string, currentText: string) => string
  /** Insère une mention complète dans le texte. */
  insertMention: (pseudo: string, currentText: string) => string
  /** Réinitialise l'état (après insertion ou blur). */
  reset: () => void
}

/**
 * Extrait le mot en cours de saisie après un déclencheur (# ou @).
 * Retourne null si le curseur n'est pas dans un hashtag/mention.
 */
function extractTrigger(text: string, selectionEnd: number): CaptionSuggestionsState | null {
  /* Cherche le dernier # ou @ avant la position du curseur. */
  const before = text.slice(0, selectionEnd)
  const hashIdx = before.lastIndexOf('#')
  const atIdx = before.lastIndexOf('@')

  const idx = Math.max(hashIdx, atIdx)
  if (idx === -1) return null

  const trigger = before[idx] as '#' | '@'
  const afterTrigger = before.slice(idx + 1)

  /* Le mot ne doit pas contenir d'espace, et doit avoir au moins MIN_CHARS. */
  if (/\s/.test(afterTrigger)) return null
  if (afterTrigger.length < MIN_CHARS) return null

  return {
    kind: trigger === '#' ? 'hashtag' : 'mention',
    query: afterTrigger,
    startIndex: idx,
  }
}

export function useCaptionSuggestions(): CaptionSuggestions {
  const [state, setState] = useState<CaptionSuggestionsState | null>(null)
  const [hashtags, setHashtags] = useState<HashtagResult[]>([])
  const [users, setUsers] = useState<UserResult[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef(0)

  /* Recherche debounce. */
  useEffect(() => {
    if (!state) {
      setHashtags([])
      setUsers([])
      setLoading(false)
      return
    }

    const generation = ++abortRef.current
    setLoading(true)

    const timer = setTimeout(async () => {
      if (generation !== abortRef.current) return

      try {
        if (state.kind === 'hashtag') {
          const results = await searchHashtags(state.query, MAX_SUGGESTIONS)
          if (generation === abortRef.current) setHashtags(results)
        } else {
          const results = await searchUsers(state.query, MAX_SUGGESTIONS)
          if (generation === abortRef.current) setUsers(results)
        }
      } catch {
        /* Erreur silencieuse : la suggestion est un nice-to-have. */
      } finally {
        if (generation === abortRef.current) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [state])

  const detect = useCallback((text: string, selectionEnd: number) => {
    const trigger = extractTrigger(text, selectionEnd)
    setState(trigger)
  }, [])

  const insertHashtag = useCallback((tag: string, currentText: string): string => {
    if (!state) return currentText
    const before = currentText.slice(0, state.startIndex)
    const after = currentText.slice(state.startIndex + state.query.length + 1)
    return `${before}#${tag} ${after}`
  }, [state])

  const insertMention = useCallback((pseudo: string, currentText: string): string => {
    if (!state) return currentText
    const before = currentText.slice(0, state.startIndex)
    const after = currentText.slice(state.startIndex + state.query.length + 1)
    return `${before}@${pseudo} ${after}`
  }, [state])

  const reset = useCallback(() => {
    setState(null)
    setHashtags([])
    setUsers([])
  }, [])

  return {
    kind: state?.kind ?? null,
    query: state?.query ?? '',
    hashtags,
    users,
    loading,
    insertHashtag,
    insertMention,
    reset,
    detect,
  }
}
