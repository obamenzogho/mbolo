import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'

const dryRun = process.env.DRY_RUN === '1'
console.log(dryRun ? '[DRY RUN] no writes' : '[LIVE] seeding posts + stories')

initializeApp({ credential: cert(JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))) })
const db = getFirestore()

// ── Utilisateurs fictifs ────────────────────────────────────
const USERS = [
  { id: 'seed-user-1', name: 'Marie Ndong', photo: 'https://i.pravatar.cc/150?u=marie' },
  { id: 'seed-user-2', name: 'Pierre Obiang', photo: 'https://i.pravatar.cc/150?u=pierre' },
  { id: 'seed-user-3', name: 'Jeanne Mba', photo: 'https://i.pravatar.cc/150?u=jeanne' },
  { id: 'seed-user-4', name: 'Lucas Ntogo', photo: 'https://i.pravatar.cc/150?u=lucas' },
  { id: 'seed-user-5', name: 'Sarah Boué', photo: 'https://i.pravatar.cc/150?u=sarah' },
]

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800',
  'https://images.unsplash.com/photo-1533450718592-29d45635f0a9?w=800',
]

// ── 10 publications fictives ────────────────────────────────
const now = Date.now()
const HOUR = 3_600_000
const DAY = 86_400_000

const POSTS = [
  {
    user: USERS[0],
    text: 'Belle journée à Libreville ! Le soleil brille et la ville est magnifique ☀️ #Libreville #Gabon',
    format: 'text',
    media: [],
    visibility: 'public',
    background: 'gabon',
    location: { name: 'Libreville, Gabon', lat: 0.3924, lng: 9.4536 },
    mood: { emoji: '😎', label: 'cool' },
    likes: 42, comments: 8, shares: 3, saves: 5,
    likedBy: ['seed-user-2', 'seed-user-3'],
    savedBy: ['seed-user-4'],
    createdAt: new Date(now - 1 * HOUR),
  },
  {
    user: USERS[1],
    text: 'Mes photos du festival des arts de Libreville 🎭✨',
    format: 'carousel',
    media: [
      { url: SAMPLE_IMAGES[0], type: 'image', width: 800, height: 600 },
      { url: SAMPLE_IMAGES[1], type: 'image', width: 800, height: 600 },
      { url: SAMPLE_IMAGES[2], type: 'image', width: 800, height: 600 },
    ],
    visibility: 'public',
    background: 'none',
    location: { name: 'Centre Culturel, Libreville' },
    likes: 87, comments: 15, shares: 12, saves: 22,
    likedBy: ['seed-user-1', 'seed-user-3', 'seed-user-4'],
    savedBy: ['seed-user-5'],
    createdAt: new Date(now - 3 * HOUR),
  },
  {
    user: USERS[2],
    text: 'Question du jour : Quel est votre plat gabonais préféré ? 🍲',
    format: 'text',
    media: [],
    visibility: 'public',
    background: 'none',
    mood: { emoji: '😋', label: 'gourmand' },
    poll: {
      question: 'Quel est votre plat gabonais préféré ?',
      options: [
        { id: '1', text: 'Poulet nyama', votes: 34, votedBy: ['seed-user-1', 'seed-user-4'] },
        { id: '2', text: 'Poisson braisé', votes: 28, votedBy: ['seed-user-2'] },
        { id: '3', text: 'Saka-saka', votes: 19, votedBy: [] },
        { id: '4', text: 'Maboké', votes: 15, votedBy: ['seed-user-5'] },
      ],
    },
    likes: 56, comments: 23, shares: 7, saves: 11,
    likedBy: ['seed-user-1', 'seed-user-5'],
    savedBy: [],
    createdAt: new Date(now - 5 * HOUR),
  },
  {
    user: USERS[3],
    text: 'Coucher de soleil incroyable sur la plage de Pointe Denis 🌅',
    format: 'image',
    media: [
      { url: SAMPLE_IMAGES[3], type: 'image', width: 1200, height: 800 },
    ],
    visibility: 'public',
    background: 'none',
    location: { name: 'Pointe Denis, Gabon' },
    mood: { emoji: '🥰', label: 'amoureux' },
    likes: 124, comments: 18, shares: 25, saves: 45,
    likedBy: ['seed-user-1', 'seed-user-2', 'seed-user-5'],
    savedBy: ['seed-user-1', 'seed-user-2'],
    createdAt: new Date(now - 8 * HOUR),
  },
  {
    user: USERS[4],
    text: 'Nouveau restaurant à Libreville, la ambiance est top ! 🍝🔥 #Foodie #Libreville',
    format: 'image',
    media: [
      { url: SAMPLE_IMAGES[5], type: 'image', width: 800, height: 800 },
    ],
    visibility: 'public',
    background: 'none',
    location: { name: 'Quartier Louis, Libreville' },
    likes: 38, comments: 9, shares: 4, saves: 8,
    likedBy: ['seed-user-2'],
    savedBy: ['seed-user-3'],
    createdAt: new Date(now - 12 * HOUR),
  },
  {
    user: USERS[0],
    text: 'Ma balade ce matin dans le parc national de la Lopé 🌿🐒 #Nature #Gabon #Lopé',
    format: 'image',
    media: [
      { url: SAMPLE_IMAGES[6], type: 'image', width: 1200, height: 800 },
    ],
    visibility: 'public',
    background: 'forest',
    location: { name: 'Parc National de la Lopé' },
    mood: { emoji: '🙏', label: 'reconnaissant' },
    likes: 91, comments: 12, shares: 18, saves: 30,
    likedBy: ['seed-user-3', 'seed-user-4'],
    savedBy: ['seed-user-2', 'seed-user-5'],
    createdAt: new Date(now - 1 * DAY),
  },
  {
    user: USERS[2],
    text: 'Récap de la semaine : moments forts, rires et belles rencontres 💪❤️ #Mbolo #Communauté',
    format: 'text',
    media: [],
    visibility: 'followers',
    background: 'sunset',
    likes: 67, comments: 14, shares: 5, saves: 9,
    likedBy: ['seed-user-1', 'seed-user-4', 'seed-user-5'],
    savedBy: ['seed-user-1'],
    createdAt: new Date(now - 1.5 * DAY),
  },
  {
    user: USERS[3],
    text: 'Tutoriel : Comment préparer un bon jus de bissap maison 🌺',
    format: 'text',
    media: [],
    visibility: 'public',
    background: 'purple',
    mood: { emoji: '🎉', label: 'en fête' },
    likes: 45, comments: 20, shares: 15, saves: 18,
    likedBy: ['seed-user-1', 'seed-user-2'],
    savedBy: ['seed-user-3', 'seed-user-4'],
    createdAt: new Date(now - 2 * DAY),
  },
  {
    user: USERS[1],
    text: 'Match de football hier soir, quelle ambiance au stade OMNISPORT ! ⚽🔥',
    format: 'image',
    media: [
      { url: SAMPLE_IMAGES[7], type: 'image', width: 800, height: 600 },
    ],
    visibility: 'public',
    background: 'none',
    location: { name: 'Stade Omnisport, Libreville' },
    likes: 103, comments: 31, shares: 20, saves: 14,
    likedBy: ['seed-user-1', 'seed-user-3', 'seed-user-4', 'seed-user-5'],
    savedBy: [],
    createdAt: new Date(now - 2.5 * DAY),
  },
  {
    user: USERS[4],
    text: 'Premier jour à mon nouveau travail, merci pour tous les messages de soutien 🙏✨ #NouveauDépart',
    format: 'text',
    media: [],
    visibility: 'public',
    background: 'ocean',
    mood: { emoji: '😀', label: 'heureux' },
    likes: 78, comments: 25, shares: 2, saves: 3,
    likedBy: ['seed-user-1', 'seed-user-2', 'seed-user-3'],
    savedBy: [],
    createdAt: new Date(now - 3 * DAY),
  },
]

// ── 5 stories fictives ──────────────────────────────────────
const STORIES = [
  {
    user: USERS[0],
    mediaUrl: SAMPLE_IMAGES[0],
    mediaType: 'image',
    caption: 'Bonne matinée à tous ! ☀️',
    textOverlay: null,
    textPosition: null,
  },
  {
    user: USERS[1],
    mediaUrl: SAMPLE_IMAGES[3],
    mediaType: 'image',
    caption: 'Spectacle en cours 🎭',
    textOverlay: 'Arts de Libreville',
    textPosition: { x: 50, y: 50 },
  },
  {
    user: USERS[2],
    mediaUrl: SAMPLE_IMAGES[5],
    mediaType: 'image',
    caption: 'Le meilleur restaurant de la ville 🍝',
    textOverlay: null,
    textPosition: null,
  },
  {
    user: USERS[3],
    mediaUrl: SAMPLE_IMAGES[6],
    mediaType: 'image',
    caption: 'En pleine nature 🌿',
    textOverlay: 'Lopé National Park',
    textPosition: { x: 50, y: 80 },
  },
  {
    user: USERS[4],
    mediaUrl: SAMPLE_IMAGES[7],
    mediaType: 'image',
    caption: 'Match épique ! ⚽',
    textOverlay: null,
    textPosition: null,
  },
]

async function main() {
  const batch = db.batch()

  // ── Seed posts ──────────────────────────────────────────────
  console.log(`\n📝 Seeding ${POSTS.length} posts...`)
  for (const post of POSTS) {
    const ref = db.collection('posts').doc()
    const postData = {
      userId: post.user.id,
      userName: post.user.name,
      userPhotoURL: post.user.photo,
      text: post.text,
      hashtags: Array.from(new Set((post.text.match(/#[\w\u00C0-\u024F]+/g) || []).map(h => h.slice(1).toLowerCase()))),
      format: post.format,
      media: post.media,
      visibility: post.visibility,
      commentsEnabled: true,
      likes: post.likes,
      likedBy: post.likedBy,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
      savedBy: post.savedBy,
      background: post.background,
      location: post.location ?? null,
      mood: post.mood ?? null,
      poll: post.poll ?? null,
      moderationStatus: 'visible',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (dryRun) {
      console.log(`  [DRY] post "${post.text.slice(0, 50)}..." → ${ref.id}`)
    } else {
      batch.set(ref, postData)
    }
  }

  // ── Seed stories ────────────────────────────────────────────
  console.log(`\n📱 Seeding ${STORIES.length} stories...`)
  const expiresAt = new Date(now + 24 * HOUR) // expire dans 24h
  for (const story of STORIES) {
    const ref = db.collection('stories').doc()
    const storyData = {
      userId: story.user.id,
      username: story.user.name,
      avatarUrl: story.user.photo,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      caption: story.caption,
      textOverlay: story.textOverlay,
      textPosition: story.textPosition,
      views: Math.floor(Math.random() * 50),
      viewedBy: [],
      savedToHighlight: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt,
    }
    if (dryRun) {
      console.log(`  [DRY] story "${story.caption}" → ${ref.id}`)
    } else {
      batch.set(ref, storyData)
    }
  }

  if (!dryRun) {
    await batch.commit()
    console.log('\n✅ Done — posts + stories written to Firestore.')
  } else {
    console.log('\n[DRY RUN] No writes performed.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
