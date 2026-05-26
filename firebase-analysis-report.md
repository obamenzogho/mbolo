# Firebase Analysis Report
Generated: 2026-05-21T01:36:01.272Z
## Environment

✅ Project: mbolo-51177
✅ Firebase CLI: installed
✅ Firestore rules: found
✅ Firestore indexes: found

## Security Rules Analysis

✅ Rules file: C:\Users\ashton\Desktop\mbolo\firestore.rules
⚠️  No data validation in write rules
✅ 1 collection/document rules defined

## Missing Indexes

✅ 10 composite indexes defined
✅ Index exists: Feed "Pour Toi" (orderBy createdAt DESC)
✅ Index exists: Feed user videos (WHERE userId + ORDER BY createdAt DESC)
✅ Index exists: Saved videos (WHERE savedBy CONTAINS + ORDER BY createdAt DESC)
✅ Index exists: Liked videos (WHERE likedBy CONTAINS + ORDER BY createdAt DESC)
✅ Index exists: Hashtag search (WHERE hashtags CONTAINS + ORDER BY createdAt DESC)
✅ Index exists: Following feed (WHERE userId IN + ORDER BY createdAt DESC)
✅ Index exists: Stories by user (WHERE userId + ORDER BY expiresAt DESC)
✅ Index exists: Highlights by user (WHERE userId + ORDER BY createdAt DESC)
✅ Index exists: Messages by participant (WHERE participants CONTAINS + ORDER BY createdAt DESC)
✅ Index exists: Notifications by user (WHERE userId + ORDER BY createdAt DESC)
✅ Index exists: User profile videos (WHERE userId + type + ORDER BY createdAt DESC)

## Slow Query Analysis

### ❌ Feed "Pour Toi" (high)

- **Fichier:** `src/hooks/useVideoFeed.ts`
- **Requête:** `query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(30))`
- **Problème:** orderBy createdAt DESC sans filtre — scan complet de la collection
- **Recommandation:** Ajouter un filtre (e.g., where("hashtags", "array-contains", "Gabon")) ou activer un cache local

### ⚠️  Feed "Suivi" (following) (medium)

- **Fichier:** `src/hooks/useVideoFeed.ts`
- **Requête:** `query(collection(db, 'videos'), where('userId', 'in', ids), orderBy('createdAt', 'desc'))`
- **Problème:** WHERE IN (10 values max) + ORDER BY nécessite un index composite. IN effectue 10 queries dédupliquées
- **Recommandation:** Index composite déjà défini. Surveiller la limite de 10 éléments IN

### ❌ Commentaires (onSnapshot) (high)

- **Fichier:** `src/hooks/useComments.ts`
- **Requête:** `onSnapshot(query(collection(db, 'videos', videoId, 'comments'), orderBy('createdAt', 'desc'), limit(20)))`
- **Problème:** OnSnapshot avec enrichissement par getDoc (N+1 pour chaque commentaire)
- **Recommandation:** Dénormaliser authorName/authorPhoto dans le document commentaire pour éviter N+1

### ⚠️  Réponses (getDocs) (medium)

- **Fichier:** `src/hooks/useComments.ts`
- **Requête:** `getDocs(query(collection(db, 'videos', videoId, 'comments', commentId, 'replies'), orderBy('createdAt', 'asc'), limit(20)))`
- **Problème:** Même problème N+1 — getDoc pour chaque réponse
- **Recommandation:** Dénormaliser les infos utilisateur dans replies

### ✅ Profil utilisateur (videos) (low)

- **Fichier:** `app/(tabs)/profile.tsx`
- **Requête:** `getDocs(query(collection(db, 'videos'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(50)))`
- **Problème:** WHERE + ORDER BY DESC — index composite requis
- **Recommandation:** Index déjà défini

### ✅ Vidéos sauvegardées (low)

- **Fichier:** `app/(tabs)/profile.tsx`
- **Requête:** `getDocs(query(collection(db, 'videos'), where('savedBy', 'array-contains', user.uid), orderBy('createdAt', 'desc'), limit(50)))`
- **Problème:** array-contains + ORDER BY — index composite requis
- **Recommandation:** Index déjà défini

### ⚠️  Notifications (onSnapshot) (medium)

- **Fichier:** `app/(tabs)/notifications.tsx`
- **Requête:** `onSnapshot(query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc')))`
- **Problème:** OnSnapshot sans LIMIT — peut devenir coûteux
- **Recommandation:** Ajouter un limit(50) et pagination

### ⚠️  Messages (onSnapshot) (medium)

- **Fichier:** `app/(tabs)/messages.tsx`
- **Requête:** `onSnapshot(query(collection(db, 'messages'), where('participants', 'array-contains', userId)))`
- **Problème:** array-contains sans ORDER BY — index existant mais pas de limite
- **Recommandation:** Ajouter orderBy("createdAt", "desc") et limit(50)


## Real-time Database Analysis

✅ No Realtime Database detected — project uses Firestore exclusively

## Firestore Real-time Listener Issues

### ❌ Video likes/saves/shares/comments (high)

- **Fichier:** `app/(tabs)/feed.tsx:117`
- **Listener:** `onSnapshot(doc(db, "videos", item.id), ...)`
- **Problème:** Écoute temps réel sur CHAQUE vidéo visible. Si 10 vidéos feed => 10 listeners
- **Recommandation:** Utiliser un cache local et rafraîchir périodiquement. Limiter le nombre de listeners actifs

### ⚠️  Commentaires vidéo (medium)

- **Fichier:** `src/hooks/useComments.ts:54-55`
- **Listener:** `onSnapshot(query(collection(db, "videos", videoId, "comments"), ...))`
- **Problème:** Listeners cumulatifs si plusieurs modals ouverts
- **Recommandation:** Nettoyage propre via le retour d'unsubscribe (déjà fait)

### ⚠️  Notifications (medium)

- **Fichier:** `app/(tabs)/notifications.tsx:17-22`
- **Listener:** `onSnapshot(query(collection(db, "notifications"), ...))`
- **Problème:** Listener actif en permanence sur l'onglet notifications
- **Recommandation:** Limiter avec limit(50) pour éviter de charger toutes les notifications

### ⚠️  Messages (medium)

- **Fichier:** `app/(tabs)/messages.tsx:22-26`
- **Listener:** `onSnapshot(query(collection(db, "messages"), ...))`
- **Problème:** Listener temps réel sans pagination
- **Recommandation:** Ajouter limit(50) + orderBy("createdAt", "desc")


## Authentication Analysis

✅ Firebase Auth initialized with browserLocalPersistence (web)
✅ AsyncStorage persistence (native)
✅ Rules require auth for all writes
✅ Auth state listener in _layout.tsx handles routing
⚠️  No email verification check in auth rules
⚠️  No rate limiting on auth endpoints (handled by Firebase)

## Storage Analysis

✅ Storage rules file found
✅ Cloudinary used as primary media upload target
✅ Firebase Storage available for direct uploads

## Summary

**Errors:** 3
**Warnings:** 10
**Total checks:** 25

### Priority Actions
1. Fix missing indexed queries (composite indexes)
2. Denormalize user data in comments/replies (eliminate N+1)
3. Add LIMIT to notification and message listeners
4. Add cache layer for Firestore reads in feed
5. Optimize feed listener count per visible video

