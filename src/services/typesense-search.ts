import Typesense from 'typesense'
import { auth } from '../lib/firebase'
import { getBlockedUserIds } from '../lib/blockService'

const search = new Typesense.Client({
  nodes: [{ host: process.env.EXPO_PUBLIC_TYPESENSE_HOST!, port: 443, protocol: 'https' }],
  apiKey: process.env.EXPO_PUBLIC_TYPESENSE_SEARCH_KEY!,
})

export interface UserResult {
  id: string
  pseudo: string
  nom?: string
  photoURL?: string
  verified?: boolean
}

export async function searchUsers(term: string, max = 15): Promise<UserResult[]> {
  const q = term.trim()
  if (!q) return []
  const res = await search.collections('users').documents().search({
    q, query_by: 'pseudo,nom', sort_by: 'followerCount:desc',
    num_typos: 2, per_page: max,
  })
  const me = auth.currentUser?.uid
  const blocked = await getBlockedUserIds()
  return (res.hits ?? [])
    .map((h: any) => h.document)
    .filter((u: any) => u.id !== me && !blocked.has(u.id))
}
