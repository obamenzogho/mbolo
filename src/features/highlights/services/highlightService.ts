import {
  collection, query, where, orderBy, limit, getDocs, doc, setDoc, updateDoc, deleteDoc,
  type DocumentData, serverTimestamp, arrayUnion, arrayRemove, increment,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { withFirestoreRetry } from '@/lib/firestoreRetry'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { captureException } from '@/lib/sentry'

export interface Highlight {
  id: string
  userId: string
  title: string
  coverUrl: string
  mediaUrls: string[]
  createdAt: Date
  storiesCount: number
  stories: string[]
}

export async function fetchHighlights(uid: string): Promise<Highlight[]> {
  try {
    const q = query(
      collection(db, 'highlights'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
    )
    const result = await withFirestoreRetry(
      () => getDocs(q),
      { context: 'highlights/fetchHighlights' },
    )
    if (result.error) {
      captureException(
        result.error instanceof Error ? result.error : new Error(String(result.error)),
        { context: 'highlights/fetchHighlights' },
      )
      return []
    }
    return (result.data as any).docs.map((d: any) => ({ id: d.id, ...d.data() }) as Highlight)
  } catch (e) {
    captureException(e instanceof Error ? e : new Error(String(e)), { context: 'fetchHighlights' })
    return []
  }
}

export async function createHighlight(
  title: string,
  coverUri: string,
  mediaUrls: string[],
): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Non authentifié')

  let coverUrl = ''
  if (coverUri) {
    if (coverUri.startsWith('http')) {
      coverUrl = coverUri
    } else {
      try {
        coverUrl = (await uploadToCloudinary(coverUri, 'image', { folder: 'highlights', timeout: 30000 })) || ''
      } catch { /* empty */ }
    }
  }

  const docRef = doc(collection(db, 'highlights'))
  await setDoc(docRef, {
    userId: user.uid,
    title,
    coverUrl,
    mediaUrls,
    stories: [],
    storiesCount: 0,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export async function addStoryToHighlight(highlightId: string, storyId: string) {
  const storySnap = await getDocs(query(collection(db, 'stories'), where('__name__', '==', storyId)))
  let mediaUrl = ''
  if (!storySnap.empty) {
    mediaUrl = storySnap.docs[0].data().mediaUrl || ''
  }
  await updateDoc(doc(db, 'highlights', highlightId), {
    stories: arrayUnion(storyId),
    mediaUrls: mediaUrl ? arrayUnion(mediaUrl) : arrayUnion(''),
    storiesCount: increment(1),
  })
  await updateDoc(doc(db, 'stories', storyId), { savedToHighlight: true })
}

export async function removeStoryFromHighlight(highlightId: string, storyId: string) {
  await updateDoc(doc(db, 'highlights', highlightId), {
    stories: arrayRemove(storyId),
    storiesCount: increment(-1),
  })
}

export async function deleteHighlight(highlightId: string) {
  const snap = await getDocs(query(collection(db, 'highlights'), where('__name__', '==', highlightId)))
  if (!snap.empty) {
    const data = snap.docs[0].data()
    const storyIds: string[] = data.stories || []
    for (const sid of storyIds) {
      try {
        await updateDoc(doc(db, 'stories', sid), { savedToHighlight: false })
      } catch { /* story may already be deleted */ }
    }
  }
  await deleteDoc(doc(db, 'highlights', highlightId))
}

export async function updateHighlightTitle(highlightId: string, title: string) {
  await updateDoc(doc(db, 'highlights', highlightId), { title })
}

export async function updateHighlightCover(highlightId: string, coverUri: string) {
  const user = auth.currentUser
  if (!user) return
  let coverUrl = ''
  try {
    coverUrl = (await uploadToCloudinary(coverUri, 'image', { folder: 'highlights', timeout: 30000 })) || ''
  } catch { return }
  if (coverUrl) {
    await updateDoc(doc(db, 'highlights', highlightId), { coverUrl })
  }
}

export async function updateHighlightMedia(
  highlightId: string,
  mediaUrls: string[],
  coverUrl?: string,
) {
  const update: Record<string, any> = { mediaUrls }
  if (coverUrl) update.coverUrl = coverUrl
  await updateDoc(doc(db, 'highlights', highlightId), update)
}

export async function updateHighlight(
  highlightId: string,
  data: { title: string; mediaUrls: string[]; coverUrl: string },
) {
  await updateDoc(doc(db, 'highlights', highlightId), {
    title: data.title,
    mediaUrls: data.mediaUrls,
    coverUrl: data.coverUrl,
  })
}

export async function reorderHighlights(orderedIds: string[]) {
  const ops = orderedIds.map((id, index) =>
    updateDoc(doc(db, 'highlights', id), { order: index }),
  )
  await Promise.all(ops)
}

export async function uploadCover(uri: string): Promise<string | null> {
  try {
    return await uploadToCloudinary(uri, 'image', { folder: 'highlights', timeout: 30000 })
  } catch { return null }
}
