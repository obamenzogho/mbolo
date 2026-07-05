import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export type Segment = { type: 'text'; value: string } | { type: 'mention'; value: string }

const MENTION_RE = /@([a-zA-Z0-9_]{2,30})/g

export function parseMentions(text: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  MENTION_RE.lastIndex = 0
  while ((m = MENTION_RE.exec(text)) !== null) {
    if (m.index > lastIndex) segments.push({ type: 'text', value: text.slice(lastIndex, m.index) })
    segments.push({ type: 'mention', value: m[1] })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) segments.push({ type: 'text', value: text.slice(lastIndex) })
  return segments
}

export function extractMentions(text: string): string[] {
  const set = new Set<string>()
  let m: RegExpExecArray | null
  MENTION_RE.lastIndex = 0
  while ((m = MENTION_RE.exec(text)) !== null) set.add(m[1].toLowerCase())
  return Array.from(set)
}

export async function resolveMentions(pseudos: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {}
  await Promise.all(pseudos.map(async (pseudo) => {
    try {
      const q = query(collection(db, 'users'), where('pseudo', '==', pseudo), limit(1))
      const snap = await getDocs(q)
      if (!snap.empty) map[pseudo] = snap.docs[0].id
    } catch {}
  }))
  return map
}
