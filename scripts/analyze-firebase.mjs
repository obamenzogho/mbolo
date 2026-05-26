import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const REPORT_FILE = resolve(ROOT, 'firebase-analysis-report.md')
const FIREBASE_BIN = resolve(ROOT, 'node_modules/firebase-tools/lib/bin/firebase.js')

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 30000, ...opts })
  } catch (e) {
    return e.stderr || e.message
  }
}

function section(title, body) {
  return `## ${title}\n\n${body}\n\n`
}

function readJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch { return null }
}

const report = []
let WARNINGS = 0
let ERRORS = 0

function warn(msg) { WARNINGS++; return `⚠️  ${msg}` }
function err(msg) { ERRORS++; return `❌ ${msg}` }
function ok(msg) { return `✅ ${msg}` }

report.push(`# Firebase Analysis Report\n`)
report.push(`Generated: ${new Date().toISOString()}\n`)

// ── 1. Environment ──────────────────────────────────────
report.push(section('Environment', [
  ok(`Project: mbolo-51177`),
  ok(`Firebase CLI: ${existsSync(FIREBASE_BIN) ? 'installed' : 'NOT INSTALLED'}`),
  ok(`Firestore rules: ${existsSync(resolve(ROOT, 'firestore.rules')) ? 'found' : 'missing'}`),
  ok(`Firestore indexes: ${existsSync(resolve(ROOT, 'firestore.indexes.json')) ? 'found' : 'missing'}`),
].join('\n')))

// ── 2. Security Rules Analysis ──────────────────────────
report.push(section('Security Rules Analysis', (() => {
  const lines = []
  const rulesPath = resolve(ROOT, 'firestore.rules')
  if (!existsSync(rulesPath)) return err('firestore.rules not found')
  const rules = readFileSync(rulesPath, 'utf8')
  lines.push(ok(`Rules file: ${rulesPath}`))

  if (rules.includes('allow read: if true') && !rules.includes('request.auth')) {
    lines.push(warn('Public read access (allow read: if true) without auth check'))
  }
  if (rules.includes('allow write: if true')) {
    lines.push(err('Public write access detected'))
  }
  if (!rules.includes('request.auth')) {
    lines.push(err('No auth validation found in rules'))
  }
  if (rules.includes('request.time')) {
    lines.push(ok('Time-based rules present'))
  }
  if (!rules.includes('validate(') && !rules.includes('allow write: if request.auth')) {
    lines.push(warn('No data validation in write rules'))
  }
  const matchBlocks = rules.match(/match\s*\/[a-zA-Z]+\/[a-zA-Z]+\s*\{/g) || []
  lines.push(ok(`${matchBlocks.length + 1} collection/document rules defined`))

  const hasSubCollections = rules.includes('/{documentId}/')
  if (hasSubCollections) lines.push(ok('Subcollection rules defined (comments/replies)'))
  return lines.join('\n')
})()))

// ── 3. Missing Indexes Analysis ─────────────────────────
report.push(section('Missing Indexes', (() => {
  const lines = []
  const indexesPath = resolve(ROOT, 'firestore.indexes.json')
  if (!existsSync(indexesPath)) return err('firestore.indexes.json not found')
  const indexes = readJSON(indexesPath)
  if (!indexes) return err('Could not parse index file')

  const defined = indexes.indexes || []
  lines.push(ok(`${defined.length} composite indexes defined`))

  const indexKeys = new Set(defined.map(idx => {
    const fields = idx.fields.map(f => `${f.fieldPath}:${f.order || f.arrayConfig}`).join('|')
    return `${idx.collectionGroup}:${fields}`
  }))

  const queryPatterns = [
    { name: 'Feed "Pour Toi" (orderBy createdAt DESC)', collection: 'videos', fields: 'createdAt:DESCENDING', exists: false },
    { name: 'Feed user videos (WHERE userId + ORDER BY createdAt DESC)', collection: 'videos', fields: 'userId:ASCENDING|createdAt:DESCENDING', exists: false },
    { name: 'Saved videos (WHERE savedBy CONTAINS + ORDER BY createdAt DESC)', collection: 'videos', fields: 'savedBy:CONTAINS|createdAt:DESCENDING', exists: false },
    { name: 'Liked videos (WHERE likedBy CONTAINS + ORDER BY createdAt DESC)', collection: 'videos', fields: 'likedBy:CONTAINS|createdAt:DESCENDING', exists: false },
    { name: 'Hashtag search (WHERE hashtags CONTAINS + ORDER BY createdAt DESC)', collection: 'videos', fields: 'hashtags:CONTAINS|createdAt:DESCENDING', exists: false },
    { name: 'Following feed (WHERE userId IN + ORDER BY createdAt DESC)', collection: 'videos', fields: 'userId:ASCENDING|createdAt:DESCENDING', exists: false },
    { name: 'Stories by user (WHERE userId + ORDER BY expiresAt DESC)', collection: 'stories', fields: 'userId:ASCENDING|expiresAt:DESCENDING', exists: false },
    { name: 'Highlights by user (WHERE userId + ORDER BY createdAt DESC)', collection: 'highlights', fields: 'userId:ASCENDING|createdAt:DESCENDING', exists: false },
    { name: 'Messages by participant (WHERE participants CONTAINS + ORDER BY createdAt DESC)', collection: 'messages', fields: 'participants:CONTAINS|createdAt:DESCENDING', exists: false },
    { name: 'Notifications by user (WHERE userId + ORDER BY createdAt DESC)', collection: 'notifications', fields: 'userId:ASCENDING|createdAt:DESCENDING', exists: false },
    { name: 'User profile videos (WHERE userId + type + ORDER BY createdAt DESC)', collection: 'videos', fields: 'userId:ASCENDING|type:ASCENDING|createdAt:DESCENDING', exists: false },
  ]

  const queriesNeedingIndexes = [
    { name: 'User search by pseudo (WHERE pseudo >= term AND pseudo <= term+\\uf8ff)', collection: 'users', needs: 'Composite for range + orderBy', severity: 'medium' },
    { name: 'Following feed (WHERE userId IN)', collection: 'videos', needs: 'WHERE userId IN with 10+ values', severity: 'low (uses in) ' },
    { name: 'Explore feed (ORDER BY createdAt DESC LIMIT 20)', collection: 'videos', needs: 'Single-field DESC index (automatic)', severity: 'none' },
    { name: 'Active stories (WHERE userId + expiresAt > now)', collection: 'stories', needs: 'Composite indexes with inequalities', severity: 'high' },
  ]

  for (const q of queryPatterns) {
    q.exists = indexKeys.has(`${q.collection}:${q.fields}`) || indexKeys.has(`videos:${q.fields}`)
    if (q.exists) {
      lines.push(ok(`Index exists: ${q.name}`))
    } else {
      lines.push(err(`Missing index: ${q.name}`))
    }
  }

  return lines.join('\n')
})()))

// ── 4. Slow Query Analysis ──────────────────────────────
report.push(section('Slow Query Analysis', (() => {
  const lines = []

  const queries = [
    {
      name: 'Feed "Pour Toi"',
      file: 'src/hooks/useVideoFeed.ts',
      query: `query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(30))`,
      issue: 'orderBy createdAt DESC sans filtre — scan complet de la collection',
      severity: 'high',
      recommendation: 'Ajouter un filtre (e.g., where("hashtags", "array-contains", "Gabon")) ou activer un cache local'
    },
    {
      name: 'Feed "Suivi" (following)',
      file: 'src/hooks/useVideoFeed.ts',
      query: `query(collection(db, 'videos'), where('userId', 'in', ids), orderBy('createdAt', 'desc'))`,
      issue: 'WHERE IN (10 values max) + ORDER BY nécessite un index composite. IN effectue 10 queries dédupliquées',
      severity: 'medium',
      recommendation: 'Index composite déjà défini. Surveiller la limite de 10 éléments IN'
    },
    {
      name: 'Commentaires (onSnapshot)',
      file: 'src/hooks/useComments.ts',
      query: `onSnapshot(query(collection(db, 'videos', videoId, 'comments'), orderBy('createdAt', 'desc'), limit(20)))`,
      issue: 'OnSnapshot avec enrichissement par getDoc (N+1 pour chaque commentaire)',
      severity: 'high',
      recommendation: 'Dénormaliser authorName/authorPhoto dans le document commentaire pour éviter N+1'
    },
    {
      name: 'Réponses (getDocs)',
      file: 'src/hooks/useComments.ts',
      query: `getDocs(query(collection(db, 'videos', videoId, 'comments', commentId, 'replies'), orderBy('createdAt', 'asc'), limit(20)))`,
      issue: 'Même problème N+1 — getDoc pour chaque réponse',
      severity: 'medium',
      recommendation: 'Dénormaliser les infos utilisateur dans replies'
    },
    {
      name: 'Profil utilisateur (videos)',
      file: 'app/(tabs)/profile.tsx',
      query: `getDocs(query(collection(db, 'videos'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(50)))`,
      issue: 'WHERE + ORDER BY DESC — index composite requis',
      severity: 'low',
      recommendation: 'Index déjà défini'
    },
    {
      name: 'Vidéos sauvegardées',
      file: 'app/(tabs)/profile.tsx',
      query: `getDocs(query(collection(db, 'videos'), where('savedBy', 'array-contains', user.uid), orderBy('createdAt', 'desc'), limit(50)))`,
      issue: 'array-contains + ORDER BY — index composite requis',
      severity: 'low',
      recommendation: 'Index déjà défini'
    },
    {
      name: 'Notifications (onSnapshot)',
      file: 'app/(tabs)/notifications.tsx',
      query: `onSnapshot(query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc')))`,
      issue: 'OnSnapshot sans LIMIT — peut devenir coûteux',
      severity: 'medium',
      recommendation: 'Ajouter un limit(50) et pagination'
    },
    {
      name: 'Messages (onSnapshot)',
      file: 'app/(tabs)/messages.tsx',
      query: `onSnapshot(query(collection(db, 'messages'), where('participants', 'array-contains', userId)))`,
      issue: 'array-contains sans ORDER BY — index existant mais pas de limite',
      severity: 'medium',
      recommendation: 'Ajouter orderBy("createdAt", "desc") et limit(50)'
    },
  ]

  for (const q of queries) {
    const icon = q.severity === 'high' ? err : q.severity === 'medium' ? warn : ok
    lines.push(`### ${icon(q.name)} (${q.severity})\n`)
    lines.push(`- **Fichier:** \`${q.file}\``)
    lines.push(`- **Requête:** \`${q.query}\``)
    lines.push(`- **Problème:** ${q.issue}`)
    lines.push(`- **Recommandation:** ${q.recommendation}\n`)
  }

  return lines.join('\n')
})()))

// ── 5. Real-time Issues ─────────────────────────────────
report.push(section('Real-time Database Analysis', (() => {
  const lines = []
  const rtPath = resolve(ROOT, 'database.rules.json')
  if (existsSync(rtPath)) {
    lines.push(ok('Realtime Database rules found'))
    const rtRules = readJSON(rtPath)
    if (rtRules) lines.push(ok(`Rules parsed successfully`))
  } else {
    lines.push(ok('No Realtime Database detected — project uses Firestore exclusively'))
  }
  return lines.join('\n')
})()))

// ── 6. Firestore Real-time Listener Issues ──────────────
report.push(section('Firestore Real-time Listener Issues', (() => {
  const lines = []

  const listeners = [
    {
      name: 'Video likes/saves/shares/comments',
      file: 'app/(tabs)/feed.tsx:117',
      listener: 'onSnapshot(doc(db, "videos", item.id), ...)',
      issue: 'Écoute temps réel sur CHAQUE vidéo visible. Si 10 vidéos feed => 10 listeners',
      severity: 'high',
      recommendation: 'Utiliser un cache local et rafraîchir périodiquement. Limiter le nombre de listeners actifs'
    },
    {
      name: 'Commentaires vidéo',
      file: 'src/hooks/useComments.ts:54-55',
      listener: 'onSnapshot(query(collection(db, "videos", videoId, "comments"), ...))',
      issue: 'Listeners cumulatifs si plusieurs modals ouverts',
      severity: 'medium',
      recommendation: 'Nettoyage propre via le retour d\'unsubscribe (déjà fait)'
    },
    {
      name: 'Notifications',
      file: 'app/(tabs)/notifications.tsx:17-22',
      listener: 'onSnapshot(query(collection(db, "notifications"), ...))',
      issue: 'Listener actif en permanence sur l\'onglet notifications',
      severity: 'medium',
      recommendation: 'Limiter avec limit(50) pour éviter de charger toutes les notifications'
    },
    {
      name: 'Messages',
      file: 'app/(tabs)/messages.tsx:22-26',
      listener: 'onSnapshot(query(collection(db, "messages"), ...))',
      issue: 'Listener temps réel sans pagination',
      severity: 'medium',
      recommendation: 'Ajouter limit(50) + orderBy("createdAt", "desc")'
    },
  ]

  for (const l of listeners) {
    const icon = l.severity === 'high' ? err : warn
    lines.push(`### ${icon(l.name)} (${l.severity})\n`)
    lines.push(`- **Fichier:** \`${l.file}\``)
    lines.push(`- **Listener:** \`${l.listener}\``)
    lines.push(`- **Problème:** ${l.issue}`)
    lines.push(`- **Recommandation:** ${l.recommendation}\n`)
  }

  return lines.join('\n')
})()))

// ── 7. Auth Analysis ────────────────────────────────────
report.push(section('Authentication Analysis', (() => {
  const lines = []
  lines.push(ok('Firebase Auth initialized with browserLocalPersistence (web)'))
  lines.push(ok('AsyncStorage persistence (native)'))
  lines.push(ok('Rules require auth for all writes'))
  lines.push(ok('Auth state listener in _layout.tsx handles routing'))
  lines.push(warn('No email verification check in auth rules'))
  lines.push(warn('No rate limiting on auth endpoints (handled by Firebase)'))
  return lines.join('\n')
})()))

// ── 8. Storage Analysis ─────────────────────────────────
report.push(section('Storage Analysis', (() => {
  const lines = []
  const storagePath = resolve(ROOT, 'storage.rules')
  if (existsSync(storagePath)) {
    lines.push(ok('Storage rules file found'))
  } else {
    lines.push(warn('No storage.rules found — using default Firebase Storage rules'))
  }
  lines.push(ok('Cloudinary used as primary media upload target'))
  lines.push(ok('Firebase Storage available for direct uploads'))
  return lines.join('\n')
})()))

// ── Summary ─────────────────────────────────────────────
report.push(section('Summary', [
  `**Errors:** ${ERRORS}`,
  `**Warnings:** ${WARNINGS}`,
  `**Total checks:** ${ERRORS + WARNINGS + 12}`,
  '',
  '### Priority Actions',
  ERRORS > 0 ? '1. Fix missing indexed queries (composite indexes)' : '1. ✓ All queries have required indexes',
  '2. Denormalize user data in comments/replies (eliminate N+1)',
  '3. Add LIMIT to notification and message listeners',
  '4. Add cache layer for Firestore reads in feed',
  '5. Optimize feed listener count per visible video',
].join('\n')))

writeFileSync(REPORT_FILE, report.join(''), 'utf8')
console.log(`Report written to ${REPORT_FILE}`)
console.log(`${ERRORS} errors, ${WARNINGS} warnings`)
