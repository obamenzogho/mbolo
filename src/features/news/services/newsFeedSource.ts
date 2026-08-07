/* newsFeedSource — source unique du fil d'actualité.
   Singleton qui encapsule fetch + ranking + pagination.
   Pattern identique à forYouFeedSource.ts. */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db } from '../../../lib/firebase'
import { captureException } from '../../../lib/sentry'
import { rankPosts, type PostUserTaste } from './postRanking'
import { buildPostUserTaste } from './buildPostUserTaste'
import type { NewsPost } from '../types'

const PAGE_SIZE = 20
const FOLLOWING_CHUNK_SIZE = 30
const MAX_CONCURRENT_FOLLOWING_QUERIES = 3

type PostSnapshot = QueryDocumentSnapshot<DocumentData>

interface FollowingCursor {
  ids: string[]
  lastDoc: PostSnapshot | null
  exhausted: boolean
}

export interface NewsFeedPage {
  posts: NewsPost[]
  isFirst: boolean
  hasMore: boolean
}

/* Affichage progressif façon Facebook : les lots Firestore sont poussés
   vers l'UI dès qu'ils sont prêts, au lieu d'attendre une page complète. */
export interface NewsFeedBatch {
  posts: NewsPost[]
  /** Dernier lot : pending vidé au maximum, hasMore définitif. */
  done: boolean
}

export interface NewsFeedFeedOptions {
  /** Appelé à chaque lot de posts déjà rankés prêts à afficher. */
  onBatch?: (batch: NewsFeedBatch) => void
}

/** Document Firestore → NewsPost. Partagé avec postMutations.loadPost :
    un post s'hydrate à l'identique dans le fil et à l'édition. */
export function mapDocToPost(snapshot: PostSnapshot): NewsPost {
  const data = snapshot.data() as Record<string, any>
  const createdAt =
    typeof data.createdAt?.toDate === 'function'
      ? data.createdAt.toDate()
      : data.createdAt instanceof Date
        ? data.createdAt
        : new Date()

  return {
    id: snapshot.id,
    userId: String(data.userId ?? ''),
    userName: String(data.userName ?? ''),
    userPhotoURL: data.userPhotoURL ?? undefined,
    text: String(data.text ?? ''),
    format: data.format ?? 'text',
    media: Array.isArray(data.media) ? data.media : [],
    visibility: data.visibility ?? 'public',
    commentsEnabled: data.commentsEnabled !== false,
    likes: Number(data.likes ?? 0),
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
    comments: Number(data.comments ?? 0),
    shares: Number(data.shares ?? 0),
    saves: Number(data.saves ?? 0),
    savedBy: Array.isArray(data.savedBy) ? data.savedBy : [],
    reposts: Number(data.reposts ?? 0),
    repostedBy: Array.isArray(data.repostedBy) ? data.repostedBy : [],
    createdAt,
    updatedAt:
      typeof data.updatedAt?.toDate === 'function'
        ? data.updatedAt.toDate()
        : undefined,
    background: data.background,
    location: data.location,
    mood: data.mood,
    poll: data.poll,
    article: data.article,
    videoShare: data.videoShare,
    hideMentionsAndHashtags: data.hideMentionsAndHashtags === true,
    rankingScore:
      typeof data.rankingScore === 'number'
        ? data.rankingScore
        : undefined,
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0

  async function runWorker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) {
        return
      }

      results[currentIndex] = await worker(items[currentIndex])
    }
  }

  const workers = Array.from(
    {
      length: Math.min(concurrency, items.length),
    },
    () => runWorker(),
  )

  await Promise.all(workers)

  return results
}

class NewsFeedSource {
  private lastPublicDoc: PostSnapshot | null = null
  private lastOwnDoc: PostSnapshot | null = null

  private followingCursors: FollowingCursor[] = []

  private pendingPosts: NewsPost[] = []
  private pendingIds = new Set<string>()

  private isFirstFetch = true
  private loading = false

  /* Précharge en cours : promesse de la page suivante. Séparée de `loading`
     pour que fetchNext ne se bloque pas dessus — un scroll pendant la
     précharge doit attendre puis servir, pas revenir à vide. */
  private prefetchPromise: Promise<void> | null = null

  private hasMoreValue = true

  private publicSourceExhausted = false
  private ownSourceExhausted = false

  private blockedIds = new Set<string>()
  private followingIds: string[] = []
  private userDataLoaded = false

  private taste: PostUserTaste = {
    likedAuthors: {},
    likedHashtags: {},
  }

  private tasteLoaded = false

  /* Après le 1er flush : le ranking reste actif en interne, mais les lots
     suivants arrivent "dans l'ordre" pour l'utilisateur (comportement FB). */
  private frozenTaste: PostUserTaste = {
    likedAuthors: {},
    likedHashtags: {},
  }

  get isLoading(): boolean {
    return this.loading
  }

  get hasMoreFlag(): boolean {
    return this.hasMoreValue || this.pendingPosts.length > 0
  }

  private async loadUserData(uid: string): Promise<void> {
    if (this.userDataLoaded) {
      return
    }

    try {
      const snapshot = await getDoc(doc(db, 'users', uid))

      if (snapshot.exists()) {
        const data = snapshot.data()

        this.blockedIds = new Set(
          Array.isArray(data.blocked) ? data.blocked : [],
        )

        const rawFollowing: unknown = data.following
        this.followingIds = Array.isArray(rawFollowing)
          ? rawFollowing.filter(
              (value: unknown): value is string =>
                typeof value === 'string',
            )
          : []
      }

      this.followingCursors = chunk(
        this.followingIds,
        FOLLOWING_CHUNK_SIZE,
      ).map((ids) => ({
        ids,
        lastDoc: null,
        exhausted: false,
      }))

      this.userDataLoaded = true
    } catch (error) {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          context: 'newsFeedSource.loadUserData',
        },
      )

      this.userDataLoaded = true
    }
  }

  private async loadTaste(uid: string): Promise<void> {
    if (this.tasteLoaded) {
      return
    }

    try {
      this.taste = await buildPostUserTaste(uid)
    } catch (error) {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          context: 'newsFeedSource.loadTaste',
        },
      )

      this.taste = {
        likedAuthors: {},
        likedHashtags: {},
      }
    } finally {
      this.tasteLoaded = true
    }
  }

  private async fetchPublicPage(): Promise<NewsPost[]> {
    if (this.publicSourceExhausted) {
      return []
    }

    const constraints: any[] = [
      where('visibility', '==', 'public'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    ]

    if (this.lastPublicDoc) {
      constraints.push(startAfter(this.lastPublicDoc))
    }

    const snapshot = await getDocs(
      query(collection(db, 'posts'), ...constraints),
    )

    if (snapshot.docs.length > 0) {
      this.lastPublicDoc =
        snapshot.docs[snapshot.docs.length - 1]
    }

    if (snapshot.docs.length < PAGE_SIZE) {
      this.publicSourceExhausted = true
    }

    return snapshot.docs.map(mapDocToPost)
  }

  private async fetchOwnPage(uid: string): Promise<NewsPost[]> {
    if (this.ownSourceExhausted) {
      return []
    }

    const constraints: any[] = [
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    ]

    if (this.lastOwnDoc) {
      constraints.push(startAfter(this.lastOwnDoc))
    }

    const snapshot = await getDocs(
      query(collection(db, 'posts'), ...constraints),
    )

    if (snapshot.docs.length > 0) {
      this.lastOwnDoc =
        snapshot.docs[snapshot.docs.length - 1]
    }

    if (snapshot.docs.length < PAGE_SIZE) {
      this.ownSourceExhausted = true
    }

    return snapshot.docs.map(mapDocToPost)
  }

  private async fetchFollowingChunk(
    cursor: FollowingCursor,
  ): Promise<NewsPost[]> {
    if (cursor.exhausted || cursor.ids.length === 0) {
      return []
    }

    const constraints: any[] = [
      where('userId', 'in', cursor.ids),
      where('visibility', '==', 'followers'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    ]

    if (cursor.lastDoc) {
      constraints.push(startAfter(cursor.lastDoc))
    }

    const snapshot = await getDocs(
      query(collection(db, 'posts'), ...constraints),
    )

    if (snapshot.docs.length > 0) {
      cursor.lastDoc = snapshot.docs[snapshot.docs.length - 1]
    }

    if (snapshot.docs.length < PAGE_SIZE) {
      cursor.exhausted = true
    }

    return snapshot.docs.map(mapDocToPost)
  }

  private filterRawPost(post: NewsPost, seen: Set<string>): boolean {
    if (seen.has(post.id)) {
      return false
    }

    if (this.blockedIds.has(post.userId)) {
      return false
    }

    if (!post.userId) {
      return false
    }

    seen.add(post.id)
    return true
  }

  /**
   * Émet progressivement les lots au fur et à mesure que les requêtes
   * se résolvent — ce qui permet un affichage immédiat des premiers posts,
   * sans attendre la fin du batch complet.
   */
  private async collectBatch(
    uid: string,
    emit: (posts: NewsPost[]) => void,
  ): Promise<void> {
    const seen = new Set<string>()
    const pending: Promise<void>[] = []

    const push = (raw: NewsPost[]) => {
      const fresh = raw.filter((post) => this.filterRawPost(post, seen))

      if (fresh.length > 0) {
        emit(fresh)
      }
    }

    /* Les posts sources sont consommés lorsqu'ils sont prêts : pas de
       Promise.all bloquant → les morceaux apparaissent les uns après
       les autres, sans ordre garanti. */
    for (const cursor of this.followingCursors.filter(
      (entry) => !entry.exhausted,
    )) {
      pending.push(
        this.fetchFollowingChunk(cursor).then((posts) => {
          push(posts)
        }),
      )
    }

    pending.push(
      this.fetchPublicPage().then((posts) => {
        push(posts)
      }),
    )

    pending.push(
      this.fetchOwnPage(uid).then((posts) => {
        push(posts)
      }),
    )

    await Promise.all(pending)
  }

  private pushToPending(posts: NewsPost[]): void {
    const unique = posts.filter((post) => {
      if (this.pendingIds.has(post.id)) {
        return false
      }

      this.pendingIds.add(post.id)
      return true
    })

    if (unique.length === 0) {
      return
    }

    const ranked = rankPosts(
      [...this.pendingPosts, ...unique],
      this.taste,
    )

    this.pendingPosts = ranked
  }

  private hasRawSourcesRemaining(): boolean {
    const followingRemaining = this.followingCursors.some(
      (cursor) => !cursor.exhausted,
    )

    return (
      !this.publicSourceExhausted ||
      !this.ownSourceExhausted ||
      followingRemaining
    )
  }

  /**
   * Récupère la prochaine page.
   *
   * - Si `onBatch` est fourni : les lots sont émis au fur et à mesure,
   *   dès que les requêtes se résolvent (comportement Facebook). Le
   *   retour contient `posts: []` car tout a déjà été poussé via le callback.
   * - Sinon : comportement historique — une page complète rankée à la fois.
   */
  async fetchNext(
    options?: NewsFeedFeedOptions,
  ): Promise<NewsFeedPage | null> {
    if (this.loading || !this.hasMoreFlag) {
      return null
    }

    /* Verrou pris avant toute attente : deux appels pendant une précharge
       se sérialisent ici (le second voit `loading`) au lieu de doubler la
       récupération. Une fois la précharge terminée, le buffer est chaud. */
    this.loading = true

    try {
      /* Un échec de précharge ne fait pas échouer ce chargement (déjà loggé). */
      if (this.prefetchPromise) {
        await this.prefetchPromise.catch(() => {})
      }

      return await this.doFetchNext(options)
    } finally {
      this.loading = false

      /* Préchargement invisible : la page suivante se charge pendant
         que l'utilisateur lit la première. */
      this.prefetchNext().catch((prefetchError) => {
        captureException(
          prefetchError instanceof Error
            ? prefetchError
            : new Error(String(prefetchError)),
          { context: 'newsFeedSource.prefetch' },
        )
      })
    }
  }

  private async doFetchNext(
    options?: NewsFeedFeedOptions,
  ): Promise<NewsFeedPage | null> {
    const uid = auth.currentUser?.uid

    if (!uid) {
      return null
    }

    const onBatch = options?.onBatch
    const isFirst = this.isFirstFetch

    const dedupe = (posts: NewsPost[]): NewsPost[] =>
      posts.filter((post) => !this.pendingIds.has(post.id))

    try {
      await this.loadUserData(uid)
      await this.loadTaste(uid)

      if (isFirst) {
        this.frozenTaste = this.taste
      }

      if (!onBatch) {
        /* Mode historique : on remplit jusqu'à la taille de page. */
        while (
          this.pendingPosts.length < PAGE_SIZE &&
          this.hasRawSourcesRemaining()
        ) {
          const batchSeen = new Set<string>()
          let appended = 0

          await this.collectBatch(uid, (raw) => {
            const unique = raw.filter(
              (post) => this.filterRawPost(post, batchSeen),
            )

            if (unique.length > 0) {
              this.pushToPending(unique)
              appended += unique.length
            }
          })

          if (appended === 0 && !this.hasRawSourcesRemaining()) {
            break
          }
        }

        const posts = this.takePendingPage()

        this.hasMoreValue =
          this.pendingPosts.length > 0 || this.hasRawSourcesRemaining()
        this.isFirstFetch = false

        return { posts, isFirst, hasMore: this.hasMoreValue }
      }

      /* Mode progressif : chaque lot résolu est ranké puis émis. */
      let emitted = 0

      while (
        emitted < PAGE_SIZE &&
        this.hasRawSourcesRemaining()
      ) {
        let batchCount = 0

        await this.collectBatch(uid, (raw) => {
          const unique = dedupe(raw)

          if (unique.length === 0) {
            return
          }

          const ranked = rankPosts(
            [...this.pendingPosts, ...unique],
            this.frozenTaste,
          )

          for (const post of unique) {
            this.pendingIds.add(post.id)
          }

          const available = PAGE_SIZE - emitted
          const serve = ranked.slice(0, available)

          this.pendingPosts = ranked.slice(available)

          for (const post of serve) {
            this.pendingIds.delete(post.id)
          }

          if (serve.length > 0) {
            emitted += serve.length
            batchCount += serve.length
            onBatch({ posts: serve, done: false })
          }
        })

        if (batchCount === 0 && !this.hasRawSourcesRemaining()) {
          break
        }
      }

      /* Dernière salve : on vide le pending pour garder la meilleure
         sélection possible sur cette page. */
      const tail = this.takePendingPage()

      this.hasMoreValue =
        this.pendingPosts.length > 0 || this.hasRawSourcesRemaining()
      this.isFirstFetch = false

      onBatch({ posts: tail, done: true })

      return { posts: [], isFirst, hasMore: this.hasMoreValue }
    } catch (error) {
      captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          context: 'newsFeedSource.fetchNext',
        },
      )

      throw error
    }
  }

  private takePendingPage(): NewsPost[] {
    const posts = this.pendingPosts.slice(0, PAGE_SIZE)

    this.pendingPosts = this.pendingPosts.slice(PAGE_SIZE)

    for (const post of posts) {
      this.pendingIds.delete(post.id)
    }

    return posts
  }

  /**
   * Pré-remplit le buffer pour la page suivante (sans émettre de batch).
   * Les queries suivantes aboutiront plus vite : les curseurs avancent.
   *
   * N'emprunte pas le verrou `loading` : un fetchNext arrivé pendant la
   * précharge l'attend (cf. fetchNext) au lieu de revenir à vide.
   */
  private async prefetchNext(): Promise<void> {
    if (this.loading || this.prefetchPromise || !this.hasMoreFlag) {
      return
    }

    const uid = auth.currentUser?.uid

    if (!uid) {
      return
    }

    this.prefetchPromise = this.collectPrefetch(uid).finally(() => {
      this.prefetchPromise = null
    })

    await this.prefetchPromise
  }

  private async collectPrefetch(uid: string): Promise<void> {
    while (
      this.pendingPosts.length < PAGE_SIZE &&
      this.hasRawSourcesRemaining()
    ) {
      const seen = new Set<string>()
      let appended = 0

      await this.collectBatch(uid, (raw) => {
        const unique = raw.filter(
          (post) => this.filterRawPost(post, seen),
        )

        if (unique.length > 0) {
          this.pushToPending(
            unique.filter((post) => !this.pendingIds.has(post.id)),
          )
          appended += unique.length
        }
      })

      if (appended === 0 && !this.hasRawSourcesRemaining()) {
        break
      }
    }
  }

  reset(): void {
    this.lastPublicDoc = null
    this.lastOwnDoc = null
    this.followingCursors = []

    this.pendingPosts = []
    this.pendingIds.clear()

    this.isFirstFetch = true
    this.loading = false
    this.prefetchPromise = null
    this.hasMoreValue = true

    this.publicSourceExhausted = false
    this.ownSourceExhausted = false

    this.blockedIds = new Set()
    this.followingIds = []
    this.userDataLoaded = false

    this.taste = {
      likedAuthors: {},
      likedHashtags: {},
    }
    this.tasteLoaded = false

    this.frozenTaste = {
      likedAuthors: {},
      likedHashtags: {},
    }
  }

  invalidateUserData(): void {
    this.userDataLoaded = false
    this.tasteLoaded = false
  }
}

export const newsFeedSource = new NewsFeedSource()
