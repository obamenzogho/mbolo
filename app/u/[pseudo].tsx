import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import OrbitLoader from '../../src/components/OrbitLoader'
import { Ionicons } from '@expo/vector-icons'

export default function PseudoResolver() {
  const { pseudo } = useLocalSearchParams<{ pseudo: string }>()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!pseudo) return
    ;(async () => {
      const normalized = pseudo.toLowerCase().trim()
      const snap = await getDoc(doc(db, 'usernames', normalized))
      const uid = snap.exists() ? snap.data()?.uid : null
      if (uid) {
        router.replace({ pathname: '/user/[userId]', params: { userId: uid } })
      } else {
        setNotFound(true)
      }
    })()
  }, [pseudo])

  if (notFound) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Ionicons name="person-remove-outline" size={48} color={colors.textSecondary} />
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Profil introuvable</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>@{pseudo} n'existe pas</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
      <OrbitLoader size={80} />
    </View>
  )
}
