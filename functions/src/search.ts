import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import Typesense from 'typesense'

const TYPESENSE_API_KEY = defineSecret('TYPESENSE_API_KEY')
const TYPESENSE_HOST = defineSecret('TYPESENSE_HOST')

const client = () => new Typesense.Client({
  nodes: [{ host: TYPESENSE_HOST.value(), port: 443, protocol: 'https' }],
  apiKey: TYPESENSE_API_KEY.value(),
})

export const syncUserToSearch = onDocumentWritten(
  { document: 'users/{uid}', secrets: [TYPESENSE_API_KEY, TYPESENSE_HOST] },
  async (event) => {
    const after = event.data?.after.data()
    const uid = event.params.uid
    if (!after) {
      await client().collections('users').documents(uid).delete().catch(() => {})
      return
    }
    await client().collections('users').documents().upsert({
      id: uid, pseudo: after.pseudo ?? '', nom: after.nom ?? '',
      photoURL: after.photoURL ?? '', verified: !!after.verified,
      followerCount: after.followerCount ?? 0,
    })
  },
)
