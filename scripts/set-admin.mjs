// scripts/set-admin.mjs
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/set-admin.mjs <uid-ou-email>
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'node:fs'

const target = process.argv[2]
if (!target) {
  console.error('❌ Fournis un UID ou un email : node scripts/set-admin.mjs <uid|email>')
  process.exit(1)
}

const sa = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'))
initializeApp({ credential: cert(sa) })
const auth = getAuth()

const user = target.includes('@')
  ? await auth.getUserByEmail(target)
  : await auth.getUser(target)

await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin: true })

console.log(`✅ Claim admin=true posé sur ${user.email ?? user.uid}`)
console.log('⚠️  Déconnecte/reconnecte-toi dans l\'app pour rafraîchir le token.')
process.exit(0)
