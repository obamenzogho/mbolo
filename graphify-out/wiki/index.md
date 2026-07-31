# Mbolo — Mémoire Architecturale

## Stack
- **Framework**: React Native / Expo SDK 54 (new arch enabled)
- **Router**: expo-router v6 (file-based, Stack + Tabs)
- **Styling**: NativeWind v4 + TailwindCSS v3 + dark theme
- **Language**: TypeScript 5.9
- **Auth**: Firebase Auth (persistence: AsyncStorage on native, localStorage on web)
- **Database**: Firestore (emulator en dev)
- **Storage**: Cloudinary (primary), Firebase Storage (fallback)
- **Video**: expo-video v3.0.16 (feed), expo-av v16.0.8 (hérité: editor/story/profile), ffmpeg-kit-react-native v6.0.2, VisionCamera v5.0.9
- **Monitoring**: Sentry (sentry-expo v7.0.1) — crash reporting, JS errors, perf monitoring, navigation tracking, upload errors
- **3D**: Three.js + @react-three/fiber + drei
- **Test**: Playwright e2e

---

## Navigation

### Root (app/_layout.tsx)
```
Stack
├── (auth)           → visible si non connecté
│   ├── login
│   └── register
├── (tabs)           → visible si connecté
│   ├── stories      → Tab "Stories" (albums icon)
│   ├── messages     → Tab "Messages" (chatbubbles icon)
│   ├── feed         → Tab "Accueil" (home icon)
│   ├── notifications → Tab "Notifications" (notifications icon)
│   └── profile      → Tab "Profil" (person icon)
│   └── (sub)         → Stack (animations slideRight/slideUpFast)
│       ├── camera, upload, story-upload, reel-upload, video-editor (slideUpFast)
│       ├── edit-profile, discover, explore (slideRightEdgeOnly)
│       ├── messages/conversation/[id]
│       └── notifications/follow-requests
├── post             → Modal (presentation: 'modal', slideUpFast)
├── settings         → Stack (slideRight, avec sous-routes)
└── autres flat routes : search, insights, hashtag/[tag], u/[pseudo],
    news-compose, post-detail, place/[id], legal/*
    + user/[userId] → profil d'un utilisateur (Stack racine depuis ADR 2026-07-31)
```

### Notification deep-links (app/_layout.tsx:22-44)
| Type | Route |
|------|-------|
| follow, follow_request | user/[userId] |
| like, comment, reply, mention, trending | feed?highlightPost=postId |
| story_view | stories |
| milestone | profile |

---

### Bottom Tab Bar (custom — refactored 2026-05-23)

Architecture : **expo-router `<Tabs>` + custom `tabBar` component** (plus stackable que `<Stack>` + sibling, meilleure perf que le `<Tabs>` natif).

```
app/(tabs)/_layout.tsx
  └── <Tabs> (expo-router)
       ├── screens × 6 (5 visibles + 1 groupe (sub))
       │   └── (sub) → <Stack> (native-stack, 11 sous-écrans)
       └── tabBar → BottomTabBar (custom)
            ├── TabItem (React.memo) × 5
            │   ├── Ionicons (26px / 32px pour Feed)
            │   └── Dot indicator (Instagram style)
            └── fond: rgba(13,17,23,0.92) + borderTop 0.5px
```

#### Fichiers créés

| Fichier | Rôle |
|---------|------|
| `src/components/ui/BottomTabBar.tsx` | Conteneur tab bar : safe areas, layout, routage |
| `src/components/ui/TabItem.tsx` | Item mémoïsé avec animations Reanimated |
| `src/hooks/useHaptics.ts` | `expo-haptics` light impact |

#### Animations (Reanimated UI thread)

- **Scale press** : `withSequence(withSpring(0.85), withSpring(1))` sur toute icône pressée
- **Dot actif** : `withSpring` sur scale + opacity, springs doux (stiffness: 300, damping: 15)
- **Pas de JS thread pendant l'animation** → 0 re-render

#### Performance

- `React.memo` sur `BottomTabBar` (compare `state.index`)
- `React.memo` sur `TabItem` (compare `isActive`, `icon`, `label`)
- La tab bar ne rerender **pas** pendant le scroll feed
- `lazy: false` → tous les screens montés immédiatement

#### Routes visibles

| Index | Route | Icon | Label | Taille icône |
|-------|-------|------|-------|-------------|
| 0 | stories | `albums` | Stories | 26px |
| 1 | messages | `chatbubbles` | Messages | 26px |
| 2 | feed | `home` | Accueil | **32px** (centré) |
| 3 | notifications | `notifications` | Notifications | 26px |
| 4 | profile | `person` | Profil | 26px |

#### Groupe `(sub)` (href: null, Stack natif)
`camera`, `upload`, `story-upload`, `reel-upload`, `video-editor`, `edit-profile`, `discover`, `explore`, `messages/conversation/[id]`, `notifications/follow-requests`

#### Dépendances ajoutées
- `expo-haptics` → retour haptique `ImpactFeedbackStyle.Light` au changement d'onglet

---

## Firestore Indexes (2026-05-23)

### Composite indexes requis (where + orderBy sur champs différents)

| # | Collection | Fields | Type | Queries impactées |
|---|-----------|--------|------|-------------------|
| 1 | `videos` | `userId` ASC, `createdAt` DESC | Index composite | feed suivi, profil vidéos, page utilisateur |
| 2 | `videos` | `savedBy` ASC, `createdAt` DESC | Index composite | profil onglet "Sauvegardes" |
| 3 | `videos` | `likedBy` ASC, `createdAt` DESC | Index composite | profil onglet "J'aime" |
| 4 | `videos` | `createdAt` DESC | Champ seul | feed Pour Toi |
| 5 | `videos` | `hashtags` ASC, `createdAt` DESC | Index composite | recherche par hashtag |
| 6 | `videos` | `userId` ASC, `type` ASC, `createdAt` DESC | Index composite | filtrage par type |
| 7 | `notifications` | `userId` ASC, `createdAt` DESC | Index composite | écran notifications |
| 8 | `highlights` | `userId` ASC, `createdAt` DESC | Index composite | highlights profil |
| 9 | `stories` | `userId` ASC, `expiresAt` **ASC** | Index composite | vérification stories actives |
| 10 | `messages` | `participants` ASC, `createdAt` DESC | Index composite | messagerie |

⚠️ **Attention** : La requête `expiresAt > date` (range) exige `expiresAt` **ASC**, pas DESC. L'index sur `stories` utilise donc `ASC`.

### Déploiement

```bash
npm run firebase:deploy:indexes
```

Les indexes sont définis dans `firestore.indexes.json` mais doivent être déployés via Firebase CLI.

---

## Error Handling Firestore (2026-05-23)

### Retry automatique (`src/lib/firestoreRetry.ts`)

```ts
withFirestoreRetry<T>(fn, { maxRetries: 3, baseDelayMs: 2000, context: '...' })
// → { data: T | null, error: { code, message } | null, retried: boolean }
```

Comportement :
- Détecte `failed-precondition` (index manquant)
- Retry × 3 avec délai exponentiel (2s → 4s → 8s)
- Log chaque tentative via `console.warn` avec contexte
- Ne throw jamais — retourne `{ data, error, retried }`

### Fallback UI (`src/components/ui/QueryErrorMessage.tsx`)

Variants :
- `banner` : barre non-bloquante avec bouton Réessayer
- `fullscreen` : écran centré pour le feed
- `toast` : notification flottante

### Fichiers modifiés avec retry + fallback

| Fichier | Requêtes wrappées |
|---------|------------------|
| `features/feed/services/feedService.ts` | `fetchSuiviVideos` (userId in + createdAt desc) |
| `features/feed/hooks/useVideoFeed.ts` | `loadMore`, `refresh` — détection index → message spécifique |
| `features/feed/components/FeedPage.tsx` | Affichage erreur feed fullscreen avec bouton Réessayer |
| `hooks/useHighlights.ts` | `getHighlights` (userId + createdAt desc) |
| `app/(tabs)/notifications.tsx` | `onSnapshot` avec callback `onError` + banner + retry |
| `app/(tabs)/profile.tsx` | `loadVideos`, `loadSaved`, `loadLiked`, `checkStories` — banners par section |
| `app/user/[userId].tsx` | `loadVideos` — banner avec retry |

---

## Firestore

### Collections & Relations

#### users (doc ID: Firebase Auth UID)
```
Fields: id, email, nom, pseudo, dateOfBirth?, photoURL?, bio?, city?,
        showAge?, followers[], following[], followerCount?, followingCount?,
        postsCount?, createdAt, verified?, externalLink?, externalLinks[],
        totalViews?, accountType?('personal'|'creator'|'business'),
        category?, privateAccount?, notifications?, seenVideos[],
        pushToken?, pushTokenUpdatedAt?
Read by: useSuggestions, useFollow, useComments, useVideoFeed, profile
Write by: auth screens, useFollow, useStories, useHighlights
```

#### videos (doc ID: auto)
```
Fields: id, userId, videoURL, thumbnailURL?, description, hashtags[],
        likes, comments, shares, saves, savedBy[]?, soundId?,
        type?('video'|'reel'), views?, likedBy[]?, createdAt
Subcollections:
  ├── comments/{commentId}
  │     Fields: userId, videoId, text, likes, likedBy[], dislikes,
  │             dislikedBy[], replyCount, createdAt
  │     Sub-subcollection:
  │       └── replies/{replyId}
  │             Fields: userId, videoId, text, replyToUsername,
  │                     username, likes, likedBy[], dislikes,
  │                     dislikedBy[], createdAt
Indexes:
  - createdAt DESC
  - userId ASC, createdAt DESC
  - savedBy CONTAINS, createdAt DESC
  - likedBy CONTAINS, createdAt DESC
  - hashtags CONTAINS, createdAt DESC
  - userId ASC, type ASC, createdAt DESC
Read by: useVideoFeed, useComments, feed.tsx, post.tsx
Write by: upload.tsx, useComments
```

#### stories (doc ID: auto)
```
Fields: id, userId, username, avatarUrl, mediaUrl, mediaType('image'|'video'),
        caption?, textOverlay?, textPosition?, createdAt, expiresAt,
        savedToHighlight?, views, viewedBy[]
Indexes:
  - userId ASC, expiresAt DESC
Read by: useStories, stories.tsx
Write by: useStories, story-upload.tsx
```

#### highlights (doc ID: auto)
```
Fields: id, userId, title, coverUrl, mediaUrls[], createdAt,
        storiesCount, stories[] (story IDs)
Indexes:
  - userId ASC, createdAt DESC
Read by: useHighlights
Write by: useHighlights
```

#### messages (doc ID: auto)
```
Fields: id, senderId, participants[], text, read, createdAt
Indexes:
  - participants CONTAINS, createdAt DESC
Read by: messages.tsx
Write by: messages.tsx
```

#### notifications (doc ID: auto)
```
Fields: id, userId, type('like'|'comment'|'follow'|'reply'),
        fromUserId, videoId?, read, createdAt
Indexes:
  - userId ASC, createdAt DESC
Read by: notifications.tsx
Write by: useFollow, useComments, lib/notifications.ts
```

#### usernames (doc ID: pseudo slug)
```
Fields: email
Usage: lookup rapide pseudo → email au login (login.tsx:52)
```

### Storage Rules (storage.rules)
| Path | Read | Write | Delete |
|------|------|-------|--------|
| /users/{userId}/** | public | auth.uid == userId | auth.uid == userId |
| /videos/** | public | auth (any) | auth (any) |
| /thumbnails/** | public | auth (any) | — |

### Firebase Config
- EXPO_PUBLIC_FIREBASE_*: apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
- EXPO_PUBLIC_SENTRY_DSN: DSN Sentry (optionnel, désactive Sentry si absent)
- Emulator: firebase.json (auth, firestore, storage, UI)
- Composant init: src/lib/firebase.ts

---

## Feature Architecture

### 1. Auth & Onboarding
**Fichiers**: app/(auth)/login.tsx, register.tsx, _layout.tsx, app/index.tsx
**Hooks**: —
**Firestore**: users (create), usernames (lookup)
**Dépendances**: firebase/auth, AsyncStorage
**Logique**: Email/password auth. Vérifie usernames collection pour pseudo unique. Redirect to login/register si non auth, sinon feed.

### 2. Feed & Discovery
**Fichiers**: app/(tabs)/feed.tsx, explore.tsx
**Feature Module**: src/features/feed/ (architecture feature-based)
**Components**: VideoItem (memoized), VideoPlayer (expo-av wrapper), FeedTopBar, FeedEmptyState
**Hooks**: useVideoFeed (refactored, ~200 lignes), useVideoAutoplay (viewport tracking)
**Services**: feedService.ts (batch Firestore queries, user caching, pagination)
**Lib**: feed.ts (seenVideos, markSeenAndIncrementView), scoring.ts (algo de score)
**Firestore**: videos (paginated, 5 indexes), users (seenVideos, batch-fetch with __name__ IN)
**Optimisations clés**:
- `removeClippedSubviews={true}` (était false — gaspillage CPU)
- `VideoItem` avec `React.memo` (zéro re-rendus inutiles)
- User data batch-fetch : plus de `getDoc` individuel par vidéo (N+1 éliminé)
- Plus de `onSnapshot` par vidéo : fetch unique des compteurs à l'activation
- `windowSize={5}`, `initialNumToRender={3}`, `maxToRenderPerBatch={3}`
- Cache utilisateur en mémoire (feedService.userCache)
- `feedTracker.ts` : analytics bufferisé avec flush périodique
- `PerformanceMonitor.tsx` : overlay FPS + compteur renders (dev only)
**Logique**:
- Feed "Pour Toi" = videos trié par score (likes 30%, comments 20%, shares 10%, views 15%, recency 25%)
- Feed "Suivi" = videos des utilisateurs suivis
- Pagination: loadMore, refresh. Cache seenVideos + mode cache (pourtoi/suivi)
- Mode caching preserve scroll position + données lors du switch pourtoi/suivi

### 3. Camera & Capture
**Fichiers**: app/(tabs)/(sub)/camera.tsx
**Hooks**: useCamera (127 lignes), useVisionCamera (253 lignes)
**Lib**: config/modules.js (dynamic module loading with mocks dev)
**Dépendances**: expo-camera, expo-media-library, expo-image-picker, react-native-vision-camera
**Logique**: 
- Deux systèmes caméra: expo-camera (simple) et VisionCamera (pro)
- Permissions, flip, zoom, mise au point, enregistrement
- Galerie: sélection multiple (max 5), albums

### 4. Upload & Editing
**Fichiers**: app/(tabs)/(sub)/upload.tsx, reel-upload.tsx, story-upload.tsx, video-editor.tsx, post.tsx
**Hooks**: useGallery (245 lignes)
**Lib**: cloudinary.ts (uploadToCloudinary), storage.ts (uploadVideo)
**Utils**: ffmpeg.ts (18 fonctions d'édition), filters.ts (8 filtres)
**Cloudinary**: uploads via unsigned preset vers dossiers reels/ ou images/
**Firestore**: videos (create), stories (create)
**Logique**: 
- Upload via Cloudinary (primary) ou Firebase Storage (fallback)
- FFmpeg editing: trim, merge, speed, filters, music, voiceover, watermark, resize
- Compression auto des images avant upload (expo-image-manipulator)
- Filtres video: normal, gabon, libreville, nuit, vintage, noir, chaud, froid

### 5. Stories & Highlights
**Fichiers**: app/(tabs)/stories.tsx
**Hooks**: useStories (200 lignes), useHighlights (230 lignes)
**Components**: HighlightPickerModal
**Firestore**: stories, highlights (indexés par userId)
**Logique**:
- Stories expirent (expiresAt), viewers tracked, auto-cleanup expired
- Highlights = collections de stories persistantes
- Cover upload via Cloudinary

### 6. Profile & Users
**Fichiers**: app/(tabs)/profile.tsx, app/(tabs)/(sub)/edit-profile.tsx, app/user/[userId].tsx
**Hooks**: useFollow (91 lignes), useSuggestions (43 lignes)
**Components**: FollowButton
**Firestore**: users (followers/following arrays, arrayUnion/arrayRemove)
**Logique**:
- Follow/Unfollow (mutual array update dans une transaction)
- Suggestions: users aléatoires (exclut self + already following)
- Edit profile: nom, pseudo, bio, photo, dateOfBirth, etc.

### 7. Comments & Sharing
**Fichiers**: app/post.tsx
**Hooks**: useComments (346 lignes)
**Components**: CommentModal, ShareSheet, ShareModal, QRCodeView
**Lib**: socialShare.ts
**Firestore**: videos/{id}/comments (subcol), comments/{id}/replies (sub-subcol)
**Logique**:
- Comments avec likes/dislikes, replies imbriquées
- Notifications créées sur comment
- Partage via Share sheet natif + QR Code

### 8. Messages
**Fichiers**: app/(tabs)/messages.tsx
**Firestore**: messages (participants CONTAINS, createdAt DESC)
**Logique**: Chat simple avec participants array, read/unread

### 9. Notifications
**Fichiers**: app/(tabs)/notifications.tsx
**Services**: notificationService.ts (227 lignes)
**Lib**: lib/notifications.ts (createNotification)
**Firestore**: notifications (userId, createdAt DESC)
**Expo**: expo-notifications (push tokens, local notifications)
**Types**: like, comment, follow, reply — avec templates notify.*()

### 10. UI System
**Components**: 18 composants réutilisables dans src/components/
**Hooks UI**: useAnimations (11 animations reanimated), usePageAnimation (4 transitions)
**Theme**: src/lib/theme.ts (dark mode, couleurs: primary #009A44, secondary #3A75C4, accent #FCD116)
**i18n**: src/i18n/ (4 langues: fr, fang, punu, nzebi)
**Navigation transitions**: src/navigation/transitions.ts (5 presets: slideUp, slideRight, fade, scale, slideBottom)

---

## Hooks & Dépendances

| Hook | Fichier | Lignes | Firestore (R/W) | Dépendances |
|------|---------|--------|-----------------|-------------|
| useVideoFeed | src/features/feed/hooks/useVideoFeed.ts | ~200 | R: videos, users (batch) | feedService.ts, scoring.ts, firebase |
| useComments | src/hooks/useComments.ts | 346 | R/W: videos, comments, replies, users | firebase, lib/notifications |
| useVisionCamera | src/hooks/useVisionCamera.ts | 253 | — | config/modules.js |
| useAnimations | src/hooks/useAnimations.ts | 240 | — | reanimated |
| useGallery | src/hooks/useGallery.ts | 245 | — | expo-media-library, expo-file-system |
| useHighlights | src/hooks/useHighlights.ts | 230 | R/W: highlights, stories | firebase, lib/cloudinary |
| useStories | src/hooks/useStories.ts | 200 | R/W: stories | firebase, lib/cloudinary |
| useCamera | src/hooks/useCamera.ts | 127 | — | expo-camera, expo-media-library |
| useFollow | src/hooks/useFollow.ts | 91 | R/W: users, notifications | firebase |
| useVideoPreloader | src/hooks/useVideoPreloader.ts | 51 | — | react-native Image |
| usePageAnimation | src/hooks/usePageAnimation.ts | 48 | — | reanimated |
| useSuggestions | src/hooks/useSuggestions.ts | 43 | R: users | firebase |

---

## Services & APIs Externes

### Cloudinary (src/lib/cloudinary.ts)
- Endpoint: api.cloudinary.com/v1_1/{CLOUD_NAME}/{type}/upload
- Auth: unsigned upload via upload preset
- Folders: reels/ pour video, images/ pour image
- Compression: expo-image-manipulator (max 1920px, quality 0.8)
- ENV: EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME, EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET

### Sentry Monitoring (src/lib/sentry.ts)
- **Package**: sentry-expo v7.0.1 / @sentry/react-native v5.5.0
- **DSN**: `EXPO_PUBLIC_SENTRY_DSN` (env var, optionnelle — désactivé si absent)
- **Init**: app/_layout.tsx:4 (avant tout import React)
- **Traces**: 20% sample rate, profiles 20%
- **User context**: uid + email attaché via onAuthStateChanged
- **Navigation tracking**: route taggée + breadcrumb via usePathname
- **Upload tracking**: transactions Sentry pour uploads Cloudinary, capture XHR/timeout/parse
- **Crashs**: ErrorBoundary capture les erreurs React avec componentStack
- **Tags**: `current_route`, `user_id` dispo sur chaque event
- **beforeSend** (2026-05-23): filtre le bruit connu (NetworkError, AbortError, ResizeObserver, Script error, ChunkLoadError, NotFoundError) — `src/lib/sentry.ts:22-38`
- **Couverture étendue** (2026-05-23): `captureException` ajouté dans 40+ blocs catch à travers:
  - Hooks: `useComments` (send/like/dislike/delete), `useStories` (crud), `useGallery` (load/save/delete), `useCamera` (permissions/save/pick), `useFollow` (follow/unfollow/check), `useHighlights` (get/delete), `useSuggestions` (fetch), `useVisionCamera` (takePhoto)
  - Services: `tenorService`, `gifService`, `notificationService` (push tokens)
  - Composants: `VideoItem` (like/save/share optimistic rollback), `HighlightPickerModal` (create/add)
  - Lib: `feed.ts` (seenVideos, markSeen), `notifications.ts` (createNotification)
- **Silent catch {} éliminés**: remplacés par au moins `console.warn` dans tous les fichiers (useGallery, feed.ts, notifications.ts, firebase.ts, ShareModal, CommentModal, ShareSheet, etc.)

### Tenor GIF (src/services/tenorService.ts)
- API: tenor.googleapis.com/v2 (featured, search)
- ENDPOINTS: trending, search GIFs africains/réaction/emoji
- ENV: EXPO_PUBLIC_TENOR_API_KEY

### Klipy GIF (src/services/gifService.ts)
- API: api.klipy.co/api/v1 (gifs, stickers)
- ENDPOINTS: trending, search, stickers
- ENV: EXPO_PUBLIC_KLIPY_API_KEY

### Expo Notifications (src/services/notificationService.ts)
- Push tokens, écouteurs, badges, templates de notifications
- Templates: newFollower, newLike, newComment, newReply, videoTrending, mention, milestone, storyViewed

### Typesense Search (src/services/searchService.ts)
- **3 collections** : `users`, `hashtags`, `posts` — la collection `posts` est **unifiée** (text, image, carousel, article, video, video_share) avec champ `mediaType` obligatoire en pratique.
- **Source unique de vérité du schéma** : `src/lib/typesense-schemas.ts` (importé par la cloud function `functions/src/search.ts` ; dupliqué inline dans `scripts/typesense-sync.mjs` avec commentaire de synchronisation).
- **3 fonctions de recherche** :
  - `searchUsers(term)` — `pseudo,nom,bio,city`, pondération `3,2,1,1`
  - `searchHashtags(term)` — `tag`, pondération 1
  - `searchPosts(term)` — tous types ; `searchVideos(term)` filtre `mediaType:=video || video_share` ; `searchPostsByType(term, types)` flexible
- **`searchMulti`** lance les 3 en parallèle avec `Promise.all` + retry `withTypesenseRetry` (429/503/504). Cache LRU 30s (`src/lib/searchCache.ts`).
- **Filtre de sécurité** : `SEARCH_FILTER_BY = 'visibility:=public && moderationStatus:!=blocked'` appliqué à toutes les requêtes `posts`.
- **Cloud Functions** : `syncUserToSearch`, `syncHashtagToSearch`, `syncPostToSearch` (triggers onDocumentWritten) ; `initSearchSchema` (admin, crée les 3 collections) ; `backfillSearch` (admin, import users + hashtags + posts publics).
- **UI** : `app/(tabs)/(sub)/explore.tsx` orchestre ; `SearchTabs` (5 onglets : Tout / Comptes / Posts / Vidéos / Tags) ; `SearchAutocomplete` (sections groupées) ; `PostResultCard` (badge icône colorée par type) ; `VideoResultCard` (badge play UNIQUEMENT si `mediaType='video'` ou `'video_share'`).
- **Limites connues** : cache `memoryLocalCache` uniquement (perdu au restart) ; pas de NetInfo ; pas de fallback offline sur les résultats de recherche.

---

## Règles de Conventions

### Architecture Fichiers
- Pages dans `app/` suivent routing expo-router (file-based)
- **Feature modules** dans `src/features/<feature>/` (components/, hooks/, services/, player/, cache/, analytics/, optimizations/)
- Logique métier dans `src/hooks/` (custom hooks génériques) OU `src/features/<feature>/hooks/` (spécifiques)
- Services API dans `src/services/` OU `src/features/<feature>/services/`
- Composants UI réutilisables dans `src/components/`
- Utilitaires génériques dans `utils/`
- Types partagés dans `src/types/`
- Traductions dans `src/i18n/`
- Lib (Firebase, Cloudinary, etc.) dans `src/lib/`

### Conventions Code
- Exports: `export function` pour hooks, `export default` pour pages
- Hooks: préfixe `use`, fichier PascalCase ou camelCase
- Styles: NativeWind avec classes Tailwind
- Composants: TypeScript strict, interfaces déclarées dans le fichier ou dans `src/types/`
- Traductions: via `useI18n()` hook, clés dans `src/i18n/translations.ts`

### Firebase & Firestore
- Auth: Firebase Auth avec AsyncStorage persistence
- Firestore: transactions pour opérations atomiques (seenVideos, follow)
- Storage: stockage local en dev (mocks), Cloudinary en prod
- Indexes: déclarés dans firestore.indexes.json (8 indexes composites)

### Dépendances Critiques
- ffmpeg-kit-react-native: édition video native (18 opérations)
- VisionCamera: capture haute performance (avec mocks dev)
- **expo-video v3.0.16**: lecture vidéo feed (remplace expo-av, compatible Fabric/New Arch)
- expo-image-manipulator: compression images
- reanimated: animations (11 types + transitions navigation)
- firebase: auth, firestore, storage
- three.js: rendu 3D (pour future feature)
- sentry-expo: crash reporting + monitoring + traces

---

## Sécurité Firestore & Storage

### Firestore Rules (`firestore.rules`) — ✅ FIXED 2026-05-24

| Path | Règle appliquée | Statut |
|------|-----------------|--------|
| `/videos/{videoId}` DELETE | `request.auth.uid == resource.data.userId` | ✅ Propriétaire uniquement |
| `/messages/{messageId}` READ | `resource.data.participants.hasAny([request.auth.uid])` | ✅ Participants uniquement |
| `/messages/{messageId}` CREATE | `request.resource.data.senderId == request.auth.uid` | ✅ Expéditeur vérifié |
| `/stories/{storyId}` CREATE/DELETE | `resource.data.userId == request.auth.uid` | ✅ Propriétaire uniquement |
| `/stories/{storyId}` UPDATE | `resource.data.userId == request.auth.uid \|\| affectedKeys(['views','viewedBy'])` | ✅ Propriétaire ou vue |
| `/notifications/{notificationId}` READ | `resource.data.userId == request.auth.uid` | ✅ Destinataire uniquement |
| `/notifications/{notificationId}` CREATE | `request.resource.data.fromUserId == request.auth.uid` | ✅ Anti-impersonation |
| `/notifications/{notificationId}` UPDATE/DELETE | `resource.data.userId == request.auth.uid` | ✅ Destinataire uniquement |
| `/highlights/{highlightId}` CREATE/DELETE | `request.resource.data.userId == request.auth.uid` / `resource.data.userId == request.auth.uid` | ✅ Propriétaire uniquement |
| `/highlights/{highlightId}` UPDATE | `resource.data.userId == request.auth.uid` | ✅ Propriétaire uniquement |
   ```storage
   // Ajouter userId dans le path (ex: /videos/{userId}/{allPaths=**})
   allow delete: if request.auth.uid == userId;
   ```

2. **Messages** — ajouter vérification participants :
   ```firestore
   allow read, write: if request.auth != null
     && request.auth.uid in resource.data.participants;
   ```

3. **Stories** — limiter write au propriétaire :
   ```firestore
   allow write: if request.auth.uid == resource.data.userId;
   ```

4. **Notifications** — limiter read au destinataire :
   ```firestore
   allow read: if request.auth.uid == resource.data.userId;
   ```

5. **Highlights** — limiter write au propriétaire :
   ```firestore
   allow create, update, delete: if request.auth.uid == request.resource.data.userId;
   ```

---

## Changelog

### 2026-05-23 — Correctifs Sentry
- **`src/lib/sentry.ts`** : fix `beforeSend` — chemin `event.exception?.values?.[0]?.value` (était `event.exception?.[0]?.values…`), tout le filtrage était bypassé
- **`src/lib/sentry.ts`** : wrapper v6 `startTransaction` dans `{ finish() { tx.end() } }` pour que `cloudinary.ts` termine correctement les spans
- **`src/hooks/useComments.ts:319`** : ajout `captureException` dans `deleteReply`
- **`src/hooks/useHighlights.ts:57`** : ajout `captureException` quand `withFirestoreRetry` échoue
- **`src/lib/feed.ts:12,28,36`** : ajout `captureException` dans `getSeenVideos`, `markSeenAndIncrementView`, `clearSeenVideos`
- **`src/lib/notifications.ts:28`** : ajout `captureException` dans `createNotification`

### 2026-05-23 — Correctifs 5 erreurs Sentry
- **`src/features/feed/components/FeedTopBar.tsx:1`** : ajout `import React` — `ReferenceError: Property 'useState' doesn't exist` dans `FeedTopBarComponent` sous Hermes
- **`src/lib/sentry.ts:27-35`** : ajout `'upstream connect error'` et `'Invalid view returned from registry'` à la liste `beforeSend` ignorée — bruit réseau Expo + build dev
- **`src/lib/firebase.ts:9`** : retrait de `// @ts-expect-error` et import statique de `initializeFirestore`/`getFirestore` → délégué à `require('firebase/firestore')` dans `initFirestore()` — résout `ReferenceError: Property 'getFirestore' doesn't exist` sous Hermes
- **`src/lib/firebase.ts:85-101`** : nouvelle fonction `initFirestore()` avec 3 niveaux de fallback — résout `initializeFirestore() called with different options` (hot-reload) en encapsulant `memoryLocalCache()` dans un scope local stable

### 2026-05-23 — Refonte CreateModal + FeedTopBar safe area
- **CreateModal** : retour au `<Modal transparent visible>` RN (au lieu de `presentation: 'modal'` Expo Router) — fond transparent pour voir la vidéo en cours. Déplacé dans `CreateModalContext` (Provider à `(tabs)/_layout.tsx`)
- **`src/contexts/CreateModalContext.tsx`** : nouveau contexte partagé — `openCreateModal`/`closeCreateModal` disponible dans tous les tabs. Modal rendu au-dessus de la tab bar avec `animationType="slide"`
- **`app/(tabs)/feed.tsx`** : état local `showCreate` + `<Modal>` supprimés → utilisation de `useCreateModal()`
- **`app/(tabs)/profile.tsx`** : bouton créer (icône `add`) utilise `openCreateModal()` au lieu de `router.push('/(tabs)/camera')`
- **`src/components/create/CreateModal.tsx`** : `visible` prop supprimée, `index={0}` (open direct), plus de `useEffect`
- **`src/components/create/CreateOption.tsx`** : bordures vertes `colors.primary` + fond transparent
- **`src/features/feed/components/FeedTopBar.tsx`** : `paddingTop` dynamique via `useSafeAreaInsets()` au lieu de valeur fixe

### 2026-05-24 — Système Follow Instagram + Modaux premium + Optimisations feed
- **Système follow Instagram complet** (`src/hooks/useFollow.ts`) : logique à 3 états (`isFollowing`, `isRequested`), `privateAccount` check, fonctions `acceptFollowRequest`/`rejectFollowRequest`, notifications `follow_request`/`follow_accept`
- **FollowButton 3 états** (`src/components/FollowButton.tsx`) : "Suivre" (vert) / "Demande envoyée" (gris) / "Abonné" (gris), `initialFollowing`/`initialRequested` props pour skip Firestore query
- **CommentModal premium** (`src/components/CommentModal.tsx`) : `animationType="none"`, backdrop animé, `Easing.out(Easing.cubic)`
- **ShareModal premium** (`src/components/ShareModal.tsx`) : mêmes animations + nouveau composant `ShareOption` avec entrée staggered, haptique, bordure verte
- **FeedPage** (`src/features/feed/components/FeedPage.tsx`) : chargement `following[]` + `pendingFollowings[]`, `allReady` guard, toggle suggestions avec icône eye, suggestions filtrées (self + inconnus)
- **Loading screen feed** : attend `allReady` (contentReady + videos > 0 + userMap > 0 + followingReady) avant rendu
- **Fix REACT-NATIVE-6** : `Promise.all([get(userRef), get(targetRef)])` avant writes dans `useFollow.ts`
- **Espacement photo + FollowButton** : `gap: 8` dans `VideoItem.tsx:257`
- **Bordure photo conditionnelle story** : prop `hasUnseenStory`, bordure jaune 2.5px
- **Username suggestions** : `fontFamily: 'Georgia', fontSize: 15`
- **Suppression fallback 'utilisateur'** : remplacé par `''` dans tous les fichiers
- **user/[userId].tsx** : remplacement du bouton inline par `FollowButton` component
- **edit-profile.tsx** : ajout toggle "Compte privé" (`privateAccount` state)
- **profile.tsx** : ajout section "Demandes en attente" dans le modal abonnés avec boutons Accepter/Refuser
- **Firestore rules** (`firestore.rules`) : autorise écriture de `pendingFollowers` par l'expéditeur
- **Types** (`src/types/index.ts`) : ajout `pendingFollowers[]`, `pendingFollowings[]`, types notif `follow_request`/`follow_accept`
- **User schema** : nouveau champ `pendingFollowers`/`pendingFollowings` (array dans le doc user)
- **SENTRY_AUTH_TOKEN** sauvegardé dans `.env`

---

### 2026-05-24 — Fix sécurité Firestore rules + Sentry cleanup
- **`firestore.rules`** : correction de 5 failles de sécurité :
  - `videos DELETE` : `if request.auth != null` → `if request.auth.uid == resource.data.userId`
  - `messages READ` : `if request.auth != null` → `if resource.data.participants.hasAny([request.auth.uid])`
  - `messages CREATE` : `if request.auth != null` → `if request.resource.data.senderId == request.auth.uid`
  - `stories WRITE` : `if request.auth != null` → restreint au propriétaire (create/update/delete), sauf `views`/`viewedBy` pour les viewers
  - `notifications READ` : `if request.auth != null` → `if resource.data.userId == request.auth.uid`
  - `notifications CREATE` : `if request.auth != null` → `if request.resource.data.fromUserId == request.auth.uid`
  - `highlights WRITE` : `if request.auth != null` → restreint au propriétaire (create/update/delete)
- **`app/(tabs)/profile.tsx`** : fix `ReferenceError: Property 'pending' doesn't exist` — déclaration `const pending` déplacée hors du bloc `try`
- **`app/(tabs)/profile.tsx`** et **`app/(tabs)/(sub)/user/[userId].tsx`** : fix event pooling React (`onLayout` → extraction synchrone des valeurs)
- **`app/(tabs)/profile.tsx`** et **`app/(tabs)/(sub)/user/[userId].tsx`** : `tabLayouts` passe de `useRef` à `useState` pour mise à jour réactive de l'indicateur de tab
- **`app/(tabs)/profile.tsx`** et **`app/(tabs)/(sub)/user/[userId].tsx`** : indicateur de tab suit le swipe en temps réel via `onScroll` + interpolation `indicatorLeft`
- **`app/(tabs)/profile.tsx`** et **`app/(tabs)/(sub)/user/[userId].tsx`** : ajout drag handle (barre horizontale) sur la modale followers/following
- **Cache Metro vidé** : suppression de `/tmp/metro-cache/*`

---

## Architecture Decision Records (ADR)

### Template pour les futures décisions

```md
## ADR-XXX — Titre de la décision

**Date :** YYYY-MM-DD
**Contexte :** Pourquoi on a dû prendre cette décision ?
**Options considérées :**
1. Option A — avantages / inconvénients
2. Option B — avantages / inconvénients
**Décision :** Option A, parce que...
**Conséquences :** Ce que ça implique pour le code, les performances, la sécurité
```

### ADR-001 — Stack : Expo + NativeWind + Tailwind

**Date :** 2025 (début du projet)
**Contexte :** Choix du framework mobile pour une app sociale gabonaise multi-plateforme (iOS, Android, Web)
**Options considérées :**
1. React Native CLI + StyleSheet — contrôle total, plus de configuration manuelle
2. Expo + NativeWind — développement rapide, OTA updates, Tailwind intégré
3. Flutter — Dart, pas de partage avec le web React
**Décision :** Expo + NativeWind, car développement rapide, mise à jour OTA, écosystème React, et Tailwind pour le styling
**Conséquences :** Nouvelle arch obligatoire (Expo SDK 52+), dépendance à l'écosystème Expo

### ADR-002 — Routing : expo-router (file-based)

**Date :** 2025
**Contexte :** Système de navigation pour l'app
**Options considérées :**
1. React Navigation classique — plus flexible, moins magique
2. expo-router — file-based, convention over configuration
**Décision :** expo-router, car :
- Convention stricte → navigation prévisible
- Routes dynamiques `[param].tsx` faciles
- Layouts imbriqués (tabs + stack)
**Conséquences :** Structure de dossiers rigide, pas de navigation arbitraire

### ADR-003 — Base de données : Firestore (NoSQL)

**Date :** 2025
**Contexte :** Choix du stockage de données principal
**Options considérées :**
1. Firestore — temps réel, serverless, intégration Firebase Auth
2. Supabase — PostgreSQL, SQL, plus mature pour queries complexes
3. Custom backend (Node.js + MongoDB) — contrôle total
**Décision :** Firestore, car :
- Temps réel natif (onSnapshot)
- Serverless — pas de backend à gérer
- Intégration directe avec Firebase Auth et Cloud Functions
- Bon pour le scale (pay-per-use)
**Conséquences :**
- Pas de queries relationnelles complexes
- Nécessite une conception de données dénormalisées
- Index composites obligatoires pour les queries filtrées+triées

### ADR-004 — Media hosting : Cloudinary (primary) + Firebase Storage (fallback)

**Date :** 2025
**Contexte :** Hébergement des vidéos et images uploadées par les utilisateurs
**Options considérées :**
1. Cloudinary seul — optimisé pour les médias, transformations à la volée
2. Firebase Storage seul — intégré à l'écosystème Firebase
3. Les deux — redondance
**Décision :** Cloudinary en primary, Firebase Storage en fallback
**Conséquences :** Upload XHR avec progress tracking, compression via expo-image-manipulator avant upload

### ADR-005 — Architecture features (src/features/)

**Date :** 2026-05
**Contexte :** Organisation du code source après la croissance du projet
**Options considérées :**
1. Flat src/components + src/hooks — simple au début, devient illisible
2. Feature modules — chaque feature est un dossier autonome
3. Screens-based — organisé par écran
**Décision :** Feature modules, car :
- Isolation des responsabilités
- Pas de dépendances circulaires entre features
- Possibilité d'extraire une feature en package indépendant plus tard
**Conséquences :** Les features communiquent via hooks génériques et types partagés, jamais directement

### ADR-006 — Monitoring : Sentry (pas Firebase Crashlytics)

**Date :** 2026-05
**Contexte :** Service de crash reporting et monitoring des performances
**Options considérées :**
1. Sentry — excellent pour React Native, traces de perf, breadcrumbs
2. Firebase Crashlytics — intégré Firebase, gratuit
3. Les deux
**Décision :** Sentry uniquement, car :
- Stack traces plus lisibles pour React Native
- Performance tracing natif
- Filtrage des erreurs configurable (beforeSend)
**Conséquences :** Budget Sentry à prévoir, DSN optionnel (désactivé si absent du .env)

### ADR-007 — Cache Firestore : memoryLocalCache uniquement

**Date :** 2026-05
**Contexte :** Stratégie de cache Firestore pour les lectures hors-ligne
**Options considérées :**
1. memoryLocalCache — cache en mémoire perdu au redémarrage
2. persistentLocalCache — cache sur disque, persiste entre sessions
3. Aucun cache
**Décision :** memoryLocalCache, car :
- Plus simple à implémenter (pas de gestion de conflits d'écriture)
- Évite les problèmes de stale data entre sessions
- Fallback élégant si indisponible (getFirestore sans options)
**Conséquences :** L'application ne fonctionne pas hors-ligne de manière persistante. À réévaluer quand l'offline-first sera implémenté.

### ADR-008 — Design système : Graphify

**Date :** 2026-05
**Contexte :** Outil maison pour maintenir la cohérence architecturale du projet
**Options considérées :**
1. Aucun outil — documentation manuelle, se base sur les PR reviews
2. Graphify — analyseur statique TypeScript custom
3. Dependency Cruiser — outil existant pour les graphes de dépendances
**Décision :** Graphify, car :
- Adapté aux besoins spécifiques du projet (Firestore, hooks, features)
- peut être utilisé comme MCP server par les assistants IA
- Génère un graphe interactif visualisable
**Conséquences :** Maintien du script graphify-cli.js, exécution après chaque modification de code

---

## ADR 2026-07-08: Fix route "settings" cassée

**Problème :** Le `_layout.tsx` racine référençait `settings` comme route, mais `app/settings/` contenait `index.tsx`, `about.tsx`, `blocked-words.tsx` sans `_layout.tsx` → expo-router ne reconnaissait pas `settings` comme route valide, causant un warning en boucle.

**Solution :** Création de `app/settings/_layout.tsx` avec un `<Stack>` simple. Les sous-routes `about` et `blocked-words` deviennent accessibles via `settings/about` et `settings/blocked-words`, et `router.push('/settings')` pointe sur `settings/index` automatiquement.

---

## ADR 2026-07-08: Fix VideoPlayer.replace synchrone

**Problème :** `useVideoPlayerPool.ts` utilisait `player.replace(null)` synchrone dans `recycleSlot()` et le cleanup `useEffect`, déclenchant 10 warnings (`5 slots × 2 nettoyages`) au reload car `expo-video` requiert `replaceAsync` pour les opérations asynchrones.

**Solution :** Remplacer les deux appels par `slot.player.replaceAsync(null)`. Les appels `loadSlot()` utilisaient déjà `replaceAsync` correctement.

---

## ADR 2026-07-08: Fix require cycle firebase ↔ sentry

**Problème :** `sentry.ts` importait `auth` depuis `firebase.ts`, et `firebase.ts` importait `captureException` depuis `sentry.ts` → cycle de dépendances, risque de `auth` non initialisé au runtime.

**Solution :** Suppression de l'import top-level dans `sentry.ts`, remplacé par un `require('./firebase')` lazy unique dans `captureException()`.

---

## ADR 2026-07-08: Migration video-editor expo-av → expo-video

**Problème :** `video-editor.tsx` utilisait `expo-av` (`Video`, `shouldPlay`, `useNativeControls`), qui est déprécié et retiré dans le SDK 54.

**Solution :** Remplacer par `expo-video` (`useVideoPlayer`, `VideoView`) avec `nativeControls`, `contentFit`, et un player partagé.

---

## ADR 2026-07-08: Fix Firestore rules — videos.read moderation filter

**Problème :** Les requêtes `useProfileTabs` (`profileTabs/own`, `profileTabs/saved`, `profileTabs/liked`, `profileTabs/tagged`) échouaient avec `permission-denied` car la règle `moderationStatus != 'hidden'` était évaluée sur tous les documents du scan, bloquant la requête entière dès qu'un document caché était rencontré.

**Solution :** Simplification de la règle en `allow read: if request.auth != null;`. La modération est déjà filtrée côté client via `.filter(v => v.moderationStatus !== 'hidden')`. La sécurité est maintenue car seuls les utilisateurs authentifiés peuvent lire.

---

## ADR 2026-07-11: Enrichissement module Actus (news)

**Décision :** Extension du module `src/features/news/` avec fond coloré, localisation, humeur et sondage.

**Détails :**
- **POST_BACKGROUNDS** (10 fonds dégradés + 'none') appliqués via `LinearGradient` sur PostCard et news-compose. Uniquement pour les posts `text` (sans media ni sondage).
- **Localisation** via `expo-location` (reverseGeocodeAsync) ; stockée comme `{name, lat, lng}` dans Firestore ; rendue sous forme de ligne avec icône pin.
- **Humeur** : modal avec 8 émotions prédéfinies ; stockée comme `{emoji, label}` ; affichée dans le `userName` du PostCard.
- **Sondage** : `PollView` composant vote (2-4 options, un seul vote par utilisateur, Firestore `runTransaction`) ; éditeur intégré dans news-compose.
- **Firestore writes** : tout est atomique dans `addDoc` ; compteur `postsCount` incrémenté via `increment`.

**Impacts :**
- Aucune nouvelle collection Firestore (tout est dans `posts/{postId}`).
- Aucun nouvel index nécessaire.
- Aucune règle de sécurité à modifier (les champs optionnels sont déjà couverts par `request.resource.data` existant).

---

## ADR 2026-07-11: Patch RN Modal — `setState` dans `componentWillUnmount` (iOS)

**Problème :** `node_modules/react-native/Libraries/Modal/Modal.js` ligne 260 appelle `this.setState({isRendered: false})` dans `componentWillUnmount` sur iOS. Avec la nouvelle architecture React Native, ce `setState` pendant le démontage crée une boucle infinie `Maximum update depth exceeded`, faisant crasher l'app au moindre démontage de Modal.

**Solution :**
1. **Patch `patch-package`** : suppression du `setState` incriminé dans `componentWillUnmount`. L'état `isRendered` n'est de toute façon plus utile après le démontage.
2. **Conditional rendering** : tous les `Modal` de l'app utilisent désormais `{condition && <Modal>}` au lieu de `visible={bool}`, évitant les cycles de rendu concurrents entre le `visible` prop et l'état interne.

**Fichiers :**
- `patches/react-native+0.81.5.patch`
- `package.json` — `postinstall` enrichi avec `patch-package`
- `app/(tabs)/stories.tsx`, `app/(tabs)/(sub)/explore.tsx`, `app/news-compose.tsx` — conversion en `{condition && <Modal>}`

---

## ADR 2026-07-27: Aligner Typesense — collection `posts` unifiée avec `mediaType`

**Problème :** Avant cette décision, le code client (`src/services/searchService.ts`) interrogeait une collection Typesense `posts` en filtrant par `mediaType` (text, image, carousel, video, video_share…), mais **la cloud function `functions/src/search.ts` ne synchronisait QUE users + hashtags** — donc aucun post n'était indexé en production. Le script de fallback `scripts/typesense-sync.mjs` définissait de son côté une collection `videos` (sans `mediaType`) et excluait les posts sans `media[]`, créant trois sources de vérité divergentes.

**Décision :**
1. **Source unique de vérité** : `src/lib/typesense-schemas.ts` exporte `POSTS_SCHEMA` (avec champ `mediaType` + `mediaUrl` + `thumbnailUrl` + `commentCount` + `userPhoto`). La cloud function l'importe directement ; le script `.mjs` duplique avec un commentaire explicite "DOIT ÊTRE IDENTIQUE À src/lib/typesense-schemas.ts".
2. **Mapping complet** : `mapPost` (cloud) et `mapPostHit` (client) couvrent tous les champs, y compris `mediaType` calculé en fallback depuis `media[].type` si absent.
3. **`searchVideos()` reste correct** : filtre `mediaType:=video || mediaType:=video_share` (`searchService.ts:152`). Pas besoin de modifier.
4. **Onglets distincts déjà présents** : `SearchTabs` a 5 onglets (Tout / Comptes / Posts / Vidéos / Tags) ; `SearchAutocomplete` sépare posts et vidéos en deux sections distinctes.
5. **Durcissement `VideoResultCard`** : le badge `play` n'apparaît QUE si `mediaType` est `video` ou `video_share` (défense en profondeur, `VideoResultCard.tsx:23`).

**Fichiers modifiés :**
- `src/services/searchService.ts` — `mapPostHit` exporté pour réutilisation
- `app/(tabs)/(sub)/explore.tsx` — suppression de la duplication (utilise `mapPostHit`)
- `src/features/search/components/VideoResultCard.tsx` — garde `isVideo`
- `functions/src/search.ts` — ajout `syncPostToSearch` + backfill posts + import `POSTS_SCHEMA` partagé
- `functions/tsconfig.json` — include `"../src/lib/typesense-schemas.ts"`
- `scripts/typesense-sync.mjs` — alignement `VIDEOS_SCHEMA` → `POSTS_SCHEMA`, `mapVideo` → `mapPost`, suppression du filtre `hasMedia`

**Conséquences :**
- Les posts `text`, `image`, `carousel`, `video`, `video_share`, `article` sont désormais tous indexés.
- L'onglet "Posts" de la recherche affichera enfin des résultats distincts de l'onglet "Vidéos".
- Le filtrage par type se fait au niveau Typesense (`searchPostsByType`) et côté client (`filterPostsByType`) pour le merge unifié.
- Aucun nouvel index Firestore requis (les requêtes restent sur `posts` côté client).
- **Action manuelle requise après déploiement** : `initSearchSchema` doit être appelé une fois pour créer la collection `posts` dans Typesense Cloud ; puis `backfillSearch` pour importer les posts existants.

---

## ADR 2026-07-29: Refonte swipe-back — Stack natif dans `(tabs)/(sub)` + fallback JS

**Problème :** Le swipe-back ne fonctionnait pas car les sous-pages (edit-profile, explore, camera…) étaient déclarées comme des onglets (`Tabs.Screen` avec `href: null`) au lieu d'être dans une vraie Stack. `router.push()` vers ces routes changeait d'onglet sans animation ni geste de retour.

**Solution :**
1. **Nouveau groupe `(sub)`** dans `app/(tabs)/(sub)/` avec un `<Stack>` natif Expo Router. Toutes les sous-pages y sont déplacées.
2. **`app/(tabs)/_layout.tsx`** simplifié : 5 onglets visibles + 1 groupe `(sub)` en `href: null`.
3. **`app/_layout.tsx`** simplifié : seuls `(auth)`, `(tabs)`, `post`, `settings` restent dans le Stack racine. Les autres flat routes (search, insights…) héritent des `screenOptions` par défaut.
4. **Fallback JS `useSwipeBack`** : Pan gesture Reanimated pour Android/Web où le geste natif de native-stack est absent ou capricieux.
5. **`SwipeBackView`** : wrapper avec underlay (parallaxe) + scrim (voile) + ombre.
6. **`PageWrapper`** enrichi : prop `swipeBack` activable, `swipeBackEdgeOnly` pour pages avec scroll horizontal, `swipeBackEnabled` pour désactiver temporairement.
7. **`usePageAnimation`** : nouveau type `stack` (pas d'animation d'entrée, la transition est déjà assurée par le native-stack).

**Fichiers créés :**
- `src/hooks/useSwipeBack.ts` — hook Pan gesture + Reanimated
- `src/components/SwipeBackView.tsx` — wrapper avec underlay/scrim
- `app/(tabs)/(sub)/_layout.tsx` — Stack du sous-groupe

**Fichiers modifiés :**
- `src/navigation/transitions.ts` — `HAS_NATIVE_SWIPE_BACK`, `slideRightEdgeOnly`
- `src/components/PageWrapper.tsx` — props `swipeBack*`, type `stack`
- `src/hooks/usePageAnimation.ts` — type `stack`
- `app/(tabs)/_layout.tsx` — suppression des href:null, ajout `(sub)`
- `app/_layout.tsx` — simplification du Stack racine
- `app/(tabs)/(sub)/*.tsx` (8 fichiers) — ajout PageWrapper avec swipeBack
- `app/(tabs)/stories.tsx` — ajout PageWrapper avec swipeBackEdgeOnly
- `app/settings/index.tsx` — migration type="stack" + swipeBack

**Fichiers déplacés (git mv) :**
- `app/(tabs)/camera.tsx, discover.tsx, upload.tsx, story-upload.tsx, reel-upload.tsx, video-editor.tsx` → `app/(tabs)/(sub)/`
- `app/explore.tsx, edit-profile.tsx` → `app/(tabs)/(sub)/`
- `app/user/[userId].tsx` → `app/(tabs)/(sub)/user/`
- `app/conversation/[id].tsx` → `app/(tabs)/(sub)/messages/conversation/`
- `app/follow-requests.tsx` → `app/(tabs)/(sub)/notifications/`

**Conséquences :**
- iOS : swipe-back natif via `fullScreenGestureEnabled` + `animationMatchesGesture`
- Android/Web : fallback JS via `useSwipeBack` (Pan gesture + Reanimated)
- `dist-ios/` retiré du suivi git (déjà dans `.gitignore`)

---

## ADR 2026-07-31: Refonte frontend Actus — PostCard monolithique → composants purs + interactions centralisées

**Problème :** L'ancien `PostCard.tsx` (~700 lignes) mélangeait UI, transactions Firestore et modales. Chaque carte montait sa propre `ImageGalleryModal` + `ReactionPicker` (≈ 80 modales pour un fil de 40 posts) et 2 hooks Firestore par carte (`useReactions` + `useNewsRepost` → 2×N listeners). `memo()` sans comparateur, `useWindowDimensions` dans la grille média, `catch {}` muet dans `useNewsFeedData`, variables mortes, `Alert.alert` au lieu d'action sheet pour les options.

**Solution — architecture en couches :**
1. **`src/features/news/components/post/`** : composants 100 % présentationnels mémoïsés (`PostCard`, `PostHeader`, `PostBody`, `PostMedia`, `PostActionBar`, `PostCardSkeleton`). La carte ne connaît plus ni Firestore ni le store : elle reçoit `post`, `currentUserId`, `viewer: PostViewerState` (primitives uniquement) et 14 handlers.
2. **`src/features/news/hooks/usePostInteractions.ts`** : remplace `useReactions` + `useNewsRepost` — un seul hook monté au niveau écran, écriture optimiste dans le store avec rollback, handlers stables (deps vides/uid), verrou anti-double-tap sur les reposts. `patch?` optionnel permet de cibler un état local hors store (cas `app/post-detail.tsx`).
3. **`src/features/news/services/postInteractions.ts`** : écritures Firestore centralisées (`setPostReaction`, `togglePostSave`, `togglePostRepost`, `incrementShareCount`).
4. **`NewsFeedScreen.tsx`** est le seul propriétaire des overlays (galerie, reaction picker, commentaires, action sheet) et couvre 5 états : squelette, erreur, vide, liste, fin de fil.
5. **`theme/postTokens.ts`** : tokens uniques (couleurs, espacements, rayons, typo) — aucun StyleSheet hors tokens ; **`utils/format.ts`** : `timeAgo`, `absoluteDate`, `formatCount`, `countLabel`.

**Décisions connexes :**
- `PostMedia` mesure la grille via `onLayout` (fini `useWindowDimensions`) ; ratio clampé `[0.72 ; 1.91]` pour 1 média, 2 côte à côte, 3 = 1+2, 4+ = 2×2 avec overlay +N.
- `openOptions` : propriétaire → Modifier/Supprimer réels (`deletePost` + `removePost`) ; non-propriétaire → `ContentActionsSheet`.
- Routes corrigées : détail = `/post-detail?postId=` (l'ancien `app/post.tsx` est l'écran de publication de reel), profil = `/(tabs)/(sub)/user/[userId]`.
- Anciens fichiers supprimés : `components/PostCard.tsx`, `hooks/useReactions.ts`, `hooks/useNewsRepost.ts`, `services/repostMutations.ts`, doublon `PostCardSkeleton` dans `Skeletons.tsx`. La collection `reposts` reste (utilisée par `src/features/repost/`).

**Backend non touché à ce stade** : les écritures de `postInteractions.ts` (update partiel `reactionCounts`/`savedBy`/`repostedBy`, sous-collections `reactions`) doivent être validées contre `firestore.rules` avant activation en prod.

---

## ADR 2026-07-31: Modèle d'écriture des posts — sous-collections d'intention + agrégats par Cloud Functions

**Problème :** Le mobile écrivait directement les agrégats sur le document `posts` (likes, reactionCounts, savedBy, reposts, shares, comments) via `runTransaction`/`increment`. Les règles autorisaient tout utilisateur authentifié à modifier ces champs (`affectedKeys().hasOnly([...agrégats])`) — écrasement possible des compteurs, impossible de tracer les intentions, et l'historique repost `users/{uid}/reposts` n'était couvert par aucune règle.

**Décision :** Adopter pour `posts` le modèle déjà en place pour `videos` : le client n'écrit que son intention dans des **sous-collections cléées par utilisateur**, et les Cloud Functions maintiennent les compteurs du document.

- `posts/{postId}/reactions/{userId}` `{ userId, type, updatedAt }` — `setDoc` merge / `deleteDoc`
- `posts/{postId}/saves/{userId}` `{ userId, createdAt }` — create/delete
- `posts/{postId}/reposts/{userId}` `{ userId, createdAt }` — create/delete (agrégat)
- `users/{userId}/reposts/{postId}` `{ userId, postId, createdAt }` — historique utilisateur (règle dédiée ajoutée)
- `posts/{postId}/shares/{userId}` `{ userId, createdAt }` — un doc par utilisateur (idempotent)
- `posts/{postId}/pollVotes/{userId}` `{ userId, optionId, updatedAt }` — vote de sondage
- `posts/{postId}/comments/{commentId}` — déjà en sous-collection ; le compteur `comments` est désormais maintenu par CF (le client n'incrémente plus)

**Règles (`firestore.rules`) :**
- `posts update` → **auteur uniquement**, `userId` immuable, et interdiction d'écrire les champs agrégats (`likes, likedBy, comments, shares, saves, savedBy, reactionCounts, reposts, repostedBy`).
- Sous-collections : `create`/`delete` réservés à l'utilisateur dont l'uid est le doc id ; `reactions`/`pollVotes` valident `type`/`optionId` et n'autorisent l'update que sur `type|updatedAt` / `optionId|updatedAt`.
- Lecture `posts` conservée (visibilité public/followers/private) — pas affaiblie.
- L'édition de post (`news-compose`) reste possible : elle n'écrit que des champs de contenu.

**Cloud Functions :**
- `functions/src/posts/onReactionWrite.ts` : `onPostReactionCreate/Update/Delete` (extraits de `index.ts`, qui n'exposait qu'une agrégation inline) — fix du `onPostReactionDelete` qui lisait `event.data.before` (inexistant en v2, le compteur n'était jamais décrémenté).
- `functions/src/posts/onEngagementWrite.ts` : `onPostSaveCreate/Delete`, `onPostRepostCreate/Delete`, `onPostShareCreate/Delete`, `onPostCommentCreate/Delete`, `onPostPollVoteWrite` (recalcul de `poll.options` depuis `pollVotes`, votes orphelins ignorés).
- `getFirestore()` appelé dans les handlers (ordre d'import vs `initializeApp()`).

**Conséquences / limites connues :**
- Les compteurs affichés sont **éventuellement cohérents** (agrégation différée par CF) — l'optimiste local masque le délai, convergence au rechargement.
- Un même utilisateur partageant plusieurs fois un même post ne compte qu'une fois (`shares/{userId}`). Accepté (aligné sur saves/reposts).
- `deleteAccount` ne nettoie pas les sous-collections orphelines sous `posts/` (reactions/saves/reposts/shares/pollVotes d'un compte supprimé) → compteurs potentiellement non remis à zéro. À traiter (CF `onPostDelete` recursive delete / recompute) dans un prochain ticket.
- **Non déployé** : règles + fonctions à déployer ensemble (`npm run firebase:deploy:rules` puis `firebase deploy --only functions`) pour éviter un état hybride.

---

## ADR 2026-07-31: Profil utilisateur déplacé dans la Stack racine (fix retour)

**Problème :** Le profil `app/(tabs)/(sub)/user/[userId].tsx` vivait dans la Stack imbriquée `(sub)` des tabs. Ouvert depuis un post (feed ou `post-detail`), il était le plus souvent la **première/unique route** de cette Stack (index 0) : `router.canGoBack()` renvoyait `false` (rien à popper dans `(sub)`, les tabs ne gèrent pas GO_BACK, Stack racine à l'index 0), et `useGoBack()` basculait sur le repli `router.replace('/(tabs)/feed')` → le feed était **remonté de zéro** (pager réinitialisé sur « Pour toi », scroll/onglet Actus perdus) au lieu de revenir sur le post. Le geste retour natif iOS était aussi inopérant (rien à popper dans `(sub)`).

**Décision :** Déplacer le profil vers la **Stack racine** (`app/user/[userId].tsx`, `git mv`), comme `post-detail`, `settings`, `news-compose`, etc.

- `app/_layout.tsx` : `<Stack.Screen name="user/[userId]" options={slideRight} />` ajouté ; `app/(tabs)/(sub)/_layout.tsx` : écran retiré.
- Tous les points d'appel (`post-detail`, `NewsFeedScreen`, `notifications`, `profile` tab, `follow-requests`, recherche, suggestions, repost, commentaires, deep-link notifs, `u/[pseudo]`) passent de `/(tabs)/(sub)/user/[userId]` à `/user/[userId]`.
- URL/deep links inchangés (`user/xxx`) ; tab bar couverte par l'écran racine (comportement identique à `post-detail`).

**Résultat — back ramène toujours au bon endroit :**
- post-detail → profil → back poppe vers `post-detail` (racine `[(tabs), post-detail, user]`) ;
- feed → profil → back revient sur **le même** `(tabs)` (état pager/scroll préservé) ;
- conversation/notifications/recherche/suggestions → retour à l'écran d'origine ;
- profil → profil (liste followers) → back empile proprement sur la racine.
- Repli `backTo` du profil conservé (`/(tabs)/profile`) — uniquement en cold-start/deep link direct.

**Swipe-back depuis le profil** : le contenu (`VideoGrid`) enveloppe sa `FlatList` dans un `GestureDetector` (`Gesture.Simultaneous(Native, Pan)` pour le pull-to-refresh custom). Cette arène de gestes **neutralise tout geste de retour** : le geste natif iOS (`fullScreenGestureEnabled` et même l'edge pan) ET le pan JS ancêtre de `SwipeBackView` (`pan began` puis annulé par le `Pan` interne `.minDistance(10)` qui s'active avant les 12 px du retour). Ceci explique pourquoi `slideRight`, `slideRightEdgeOnly` puis le pan JS seul échouaient tous.

**Fix (composition simultanée) :**
- `PageWrapper`/`SwipeBackView` : nouveau prop `onSwipeBackGesture` qui **expose le pan de retour JS**.
- `VideoGrid` : nouveau prop `simultaneousGesture` — le pan de retour est composé `Gesture.Simultaneous(native, pan, backPan)` au lieu d'être éclipsé.
- `app/user/[userId].tsx` : branche les deux (`onSwipeBackGesture={setBackGesture}`, `simultaneousGesture={backGesture}`).
- **iOS poussé** : le geste natif est réactivé (route `user/[userId]` = `slideRight`, comme `post-detail`/`settings`). Pour que l'arène de `VideoGrid` ne le bloque plus, **iOS ne monte plus le `GestureDetector`** : le pull-to-refresh y est déclenché par le rebond natif du scroll (`contentOffset.y < -80` dans `onScroll`), comportement iOS standard. → `needsJsGesture=false` → pas de `SwipeBackView` → **parallaxe native sur la vraie page précédente, zéro fond noir**.
- **Android / Web** : pas de geste natif → le pan JS est seul à assurer le retour, toujours composé en simultané dans l'arène de `VideoGrid` (`Gesture.Simultaneous(native, pan, backPan)`).

Résultat : swipe-back de bord fonctionne sur iOS, Android et Web, y compris sur le contenu `VideoGrid`. Le `VideoGrid` reste utilisable tel quel ailleurs (le prop est optionnel).

**Fond noir au relâchement (iOS) :** la sous-couche simulée du geste JS est un simple fond sombre (pas de vraie page précédente), et la fausse animation de fermeture JS s'enchaînait avec le pop natif → écran noir avant l'apparition de la page. Garde-fou dans `useSwipeBack` : sur iOS, au relâchement validé, `translateX` est réinitialisé à 0 et `router.back()` est appelé immédiatement — c'est le **pop natif** qui anime la sortie avec la parallaxe de la vraie page (pas de noir). Android/Web conservent la fermeture JS animée. Ce chemin ne s'active plus pour le profil poussé (le natif gère), mais reste le filet de sécurité des écrans iOS en premier de Stack.

**À surveiller (même patron) :** `messages/conversation/[id]` et `notifications/follow-requests` restent dans `(sub)` : ouverts en premier écran de cette Stack, leur retour tombe aussi dans le repli. À migrer vers la racine si le même symptôme est signalé (ou à mutualiser via un helper).

---

## ADR 2026-07-31: En-tête de post Actus au niveau Facebook + i18n du module news

**Décision :** Porter l'en-tête des posts Actus au niveau Facebook : badge vérifié, ligne d'activité (humeur · lieu), horodatage relatif FB (« Hier », « Il y a X »), bouton Suivre, anneau de story, menu « … » enrichi (copier le lien / sauvegarder / ne plus suivre / signaler / bloquer), et internationaliser l'ensemble du module news (fr/fang/punu/nzebi).

**Schema (`posts`)** :
- Nouveau champ **`verified?: boolean`**, dénormalisé depuis le doc `users` **à la création** du post (`app/news-compose.tsx`).
- Règles : sur `create`, `verified` doit être absent ou égal au `verified` du doc user (impossible de l'inventer côté client) ; `verified` ajouté à la **blocklist** de `posts update` (seul le backend peut le faire évoluer).

**Header** (`PostHeader.tsx`, désormais seul non-strictement-présentationnel du module) :
- **Badge vérifié** : `checkmark-circle` (couleur `postColors.verified`).
- **Ligne d'activité** : `se sent {emoji} {label} · est à {lieu}` — le lieu quitte `PostBody` (plus de doublon). Libellés d'humeur traduits via `t.news.moods[emoji]` (fallback sur le label stocké).
- **Horodatage FB** : `timeAgo(date, now, labels)` prend désormais des `labels` i18n (interface `TimeLabels`) — « À l'instant », « Il y a {n} min/h/j », « Hier » (24-48 h), sinon date fr-FR. Compatible avec les anciens appels (labels fr par défaut).
- **Bouton Suivre** : même pattern que `AuthorInfo` du feed (`useFollowFast` + `useFollowAction` + état `idle/done/hidden` avec timer 2 s), **dans la ligne du nom** (nom tronqué via `flexShrink`, pastille toujours visible à sa droite), masqué si propriétaire ou déjà suivi. Lecture d'abonnement ignorée pour ses propres posts (`useFollowFast('')`).
- **Anneau de story** : simple bordure 2 px `postColors.accent` (pattern `StoryCard.avatarRing`, pas de dégradé) quand l'auteur a une story non lue.
- Accessibilité (labels d'écran) traduite.

**Anneaux par carte — zéro N+1** : nouveau `src/features/news/hooks/useActiveStories.ts` — un seul `getDocs` groupé par page de fil (`where('userId','in',[…30])` + `where('expiresAt','>',now)` + `limit(100)`), index composite `stories userId ASC + expiresAt ASC` déjà existant. `NewsFeedScreen` déduit les auteurs visibles et propage `hasStory` par carte. Limites : plafonné à 30 auteurs par page, pas de filtrage `privateAccount`, l'anneau n'ouvre pas le viewer de stories (tap = profil) — amélioration documentée pour un prochain ticket.

**Menu « … » enrichi** (`ContentActionsSheet`, props optionnels — les autres appelants `user/[userId]`, `post-detail` restent inchangés) : `onCopyLink` (deep link `mbolo://post/{id}` + `expo-clipboard`, toast local), `onToggleSave` (`isSaved`), `onToggleFollow` (`isFollowing`), en plus de Signaler/Bloquer existants. `NewsFeedScreen` câble le tout avec `useFollowFast`/`useFollowAction` sur l'auteur de la feuille ouverte (un seul getDoc actif à la fois).

**i18n** : nouvelle section `t.news.*` (time, moods, menu, feed states, actions) dans `src/i18n/translations.ts` pour les 4 langues. `timeAgo` reste pur (labels injectés). ⚠️ **Fang/Punu/Nzebi à faire relire par un locuteur natif** (traductions best-effort, réutilisant le vocabulaire existant du fichier).

**Limites connues** :
- Le cache 60 s de `useFollowFast` peut afficher un état de suivi périmé après une action via le menu (norme app).
- Le mode édition de post n'écrit pas `verified` (inchangé) — conformité garantie par les règles.
- `absoluteDate` (lecteurs d'écran) reste fr-FR.

### ADR — Légende du post : état d'expansion remonté à l'écran + correction « modifié »

**Décision :** Rendre la légende cohérente avec l'architecture (cart 100 % présentationnelle) et corriger deux défauts.

**Corrections** :
- **Bug « Modifié » fantôme** : le flux de création écrivait `updatedAt` → tous les posts affichaient « modifié ». `updatedAt` n'est désormais écrit que par l'édition (`app/news-compose.tsx`). En plus, `PostHeader` n'affiche « modifié » que si `updatedAt - createdAt > 60 s` (couverture des anciens docs en base).
- **`expanded` remonté** : l'état de dépliage n'est plus un `useState` local à `PostBody` (perdu au recyclage FlatList) mais un `ReadonlySet<string>` possédé par `NewsFeedScreen` ; `PostBody`/`PostCard` restent présentationnels (props `expanded` + `onToggleExpanded`). `post-detail` déplie par défaut (`useState(true)`). Le comparateur mémo de `PostCard` compare `expanded`.
- **Variante hero** : même repli que l'inline — `numberOfLines` 8 replié, plus de coupe quand déplié, lien « Voir plus / Voir moins » sous le dégradé (padding dédié `heroMoreLink`).
- **`RichPostText`** : typage strict (`style?: StyleProp<TextStyle>`, plus de `any`), `accessibilityRole="link"` sur les tokens `#`/`@`, détection de token sans regex globale mutante.
- **i18n** : `a11yOpenPost` (label « Ouvrir la publication ») ajouté en 4 langues (plus de français codé en dur dans `PostCard`).

**Limite** : le dépliage ne survit pas à un `refresh()` du fil (les posts sont remplacés) — acceptable.

### ADR — Grille média du post : états chargement/erreur, ratios, i18n

**Décision :** Durcir le composant média (`PostMedia.tsx`) : états explicites, ratios non carrés, labels accessibilité internationalisés.

**Changements** :
- **`TileImage`** : sous-composant qui enveloppe `expo-image` et suit `onLoadStart/onLoad/onError` → **skeleton** `ShimmerBlock` (pulsation opacité, `postColors.surfaceRaised`) sur toute la tuile pendant le chargement, icône `image-outline` si échec. Plus d'image « transparente » silencieuse, plus d'`OrbitLoader` par tuile.
- **`ShimmerBlock` unifié** : `PostCardSkeleton` n'a plus son propre `Shimmer` en doublon (déduplication vers `Skeletons.tsx`), et `style` y est typé `StyleProp<ViewStyle>` (plus de `any`).
- **Ratios** : helper `naturalRatio(item)` (ratio réel clampé 0.72–1.91). Appliqué à **1** (comme avant), **2** (cellules côte à côte au ratio du premier visuel — fini le carré qui écrasait les portraits) et **3** (« une + deux »). La grille 4+ reste carrée.
- **i18n** : labels accessibilité `a11yMediaOpen` (« Agrandir le média {n} »), `a11yMediaMore`, `a11yVideoPlay` en 4 langues, interpolation via `interpolate()` (exporté de `utils/format.ts`).
- **Tokens** : `postColors.onMedia` (`#FFFFFF`) pour texte/icônes sur média — plus d'hex en dur dans `PostMedia` ni dans le texte hero de `PostBody`.

**Limites** :
- 2 visuels de ratios différents : le second est recadré au ratio du premier.
- Traductions fang/punu/nzebi best-effort (à faire relire par un natif, cf. note existante).

