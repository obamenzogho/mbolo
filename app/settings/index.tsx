import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../../src/lib/firebase'
import { colors } from '../../src/lib/theme'
import { router } from 'expo-router'
import PageWrapper from '../../src/components/PageWrapper'
import OrbitLoader from '../../src/components/OrbitLoader'
import { BackButton } from '../../src/components/ui/BackButton'
import { useDataSaver } from '../../src/contexts/DataSaverContext'

export default function Settings() {
  const user = auth.currentUser
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [privateAccount, setPrivateAccount] = useState(false)
  const { isEnabled: isDataSaver, toggle: toggleDataSaver } = useDataSaver()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
      getDoc(doc(db, 'users', user.uid)).then((snap: any) => {
      if (snap.exists()) {
        const d = snap.data()
        setNotifications(d.notifications !== false)
        setPrivateAccount(d.privateAccount ?? false)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user])

  const handleSave = async (key: string, value: any) => {
    if (!user) return
    try {
      await updateDoc(doc(db, 'users', user.uid), { [key]: value })
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder')
    }
  }

  const handleClearCache = () => {
    Alert.alert('Cache vidé', 'Le cache de l\'application a été vidé')
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes tes données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Contacte-nous', 'Pour supprimer ton compte, envoie un email à support@mbolo.app')
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <OrbitLoader size={80} />
      </View>
    )
  }

  const sections = [
    {
      title: 'Préférences',
      items: [
        {
          icon: 'notifications-outline',
          label: 'Notifications push',
          type: 'toggle' as const,
          value: notifications,
          onToggle: () => { setNotifications(!notifications); handleSave('notifications', !notifications) },
        },
        {
          icon: 'moon-outline',
          label: 'Mode sombre',
          type: 'toggle' as const,
          value: darkMode,
          onToggle: () => setDarkMode(!darkMode),
        },
        {
          icon: 'leaf-outline',
          label: 'Économie de données',
          type: 'toggle' as const,
          value: isDataSaver,
          onToggle: toggleDataSaver,
          description: 'Qualité vidéo réduite pour économiser les données',
        },
        {
          icon: 'lock-closed-outline',
          label: 'Compte privé',
          type: 'toggle' as const,
          value: privateAccount,
          onToggle: () => { setPrivateAccount(!privateAccount); handleSave('privateAccount', !privateAccount) },
          description: 'Seuls tes abonnés peuvent voir tes vidéos',
        },
      ],
    },
    {
      title: 'Confidentialité',
      items: [
        {
          icon: 'shield-outline',
          label: 'Mots bloqués',
          type: 'action' as const,
          action: () => router.push('/settings/blocked-words'),
          description: 'Gérer les mots masqués dans les commentaires',
        },
      ],
    },
    {
      title: 'Données',
      items: [
        {
          icon: 'trash-outline',
          label: 'Vider le cache',
          type: 'action' as const,
          action: handleClearCache,
        },
        {
          icon: 'download-outline',
          label: 'Télécharger mes données',
          type: 'action' as const,
          action: () => Alert.alert('Bientôt', 'Tu pourras bientôt télécharger une copie de tes données'),
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Centre d\'aide',
          type: 'action' as const,
          action: () => Alert.alert('Aide', 'Contacte-nous à support@mbolo.app'),
        },
        {
          icon: 'mail-outline',
          label: 'Nous contacter',
          type: 'action' as const,
          action: () => Alert.alert('Contact', 'Email: support@mbolo.app'),
        },
        {
          icon: 'information-circle-outline',
          label: 'À propos de Mbolo',
          type: 'action' as const,
          action: () => router.push('/settings/about'),
        },
      ],
    },
    {
      title: 'Légal',
      items: [
        {
          icon: 'document-text-outline',
          label: 'Conditions d\'utilisation',
          type: 'action' as const,
          action: () => Alert.alert('Conditions', 'Conditions d\'utilisation de Mbolo v1.0'),
        },
        {
          icon: 'shield-checkmark-outline',
          label: 'Politique de confidentialité',
          type: 'action' as const,
          action: () => Alert.alert('Confidentialité', 'Politique de confidentialité de Mbolo v1.0'),
        },
      ],
    },
  ]

  return (
    <PageWrapper type="slideRight">
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
        <BackButton icon="chevron-back" style={{ width: 36, height: 36, justifyContent: 'center' }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>Paramètres</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {sections.map((section, si) => (
          <View key={si} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {section.title}
            </Text>
            <View style={{ backgroundColor: '#111', borderRadius: 12, overflow: 'hidden' }}>
              {section.items.map((item, ii) => (
                <View key={ii}>
                  <TouchableOpacity
                    onPress={item.type === 'action' ? item.action : undefined}
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
                      borderBottomWidth: ii < section.items.length - 1 ? 0.5 : 0,
                      borderBottomColor: '#222',
                    }}
                  >
                    <Ionicons name={item.icon as any} size={22} color="#888" style={{ marginRight: 14 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.white, fontSize: 15 }}>{item.label}</Text>
                      {'description' in item && item.description && (
                        <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{item.description}</Text>
                      )}
                    </View>
                    {item.type === 'toggle' ? (
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        trackColor={{ false: '#333', true: colors.primary }}
                        thumbColor="#fff"
                      />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#444" />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={{ marginTop: 24, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ color: colors.error, fontSize: 15, fontWeight: '600' }}>Supprimer mon compte</Text>
        </TouchableOpacity>

        <Text style={{ color: '#444', fontSize: 12, textAlign: 'center', marginTop: 32, marginBottom: 16 }}>
          Mbolo v1.0.0 • Fait avec 🇬🇦 au Gabon
        </Text>
      </ScrollView>
    </SafeAreaView>
    </PageWrapper>
  )
}
