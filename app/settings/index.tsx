import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../src/lib/theme'
import { router } from 'expo-router'
import PageWrapper from '@/components/PageWrapper'
import { BackButton } from '../../src/components/ui/BackButton'

interface HubItem {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  description: string
  route: string
}

const CATEGORIES: HubItem[] = [
  { icon: 'person-circle-outline', label: 'Compte', description: 'Profil, email, type de compte, suppression', route: '/settings/account' },
  { icon: 'lock-closed-outline', label: 'Confidentialité', description: 'Compte privé, interactions, blocages', route: '/settings/privacy' },
  { icon: 'notifications-outline', label: 'Notifications', description: 'Push par catégorie, permissions', route: '/settings/notifications' },
  { icon: 'shield-checkmark-outline', label: 'Sécurité', description: 'Mot de passe, sessions, alertes', route: '/settings/security' },
  { icon: 'options-outline', label: 'Préférences', description: 'Thème, lecture auto, données', route: '/settings/preferences' },
  { icon: 'accessibility-outline', label: 'Accessibilité', description: 'Animations, taille du texte, contraste', route: '/settings/accessibility' },
  { icon: 'server-outline', label: 'Stockage', description: 'Cache, téléchargement des données', route: '/settings/storage' },
  { icon: 'hourglass-outline', label: "Temps d'utilisation", description: 'Activité, rappels de pause', route: '/settings/screen-time' },
  { icon: 'help-buoy-outline', label: "Centre d'aide", description: 'FAQ, contact, mentions légales', route: '/settings/help' },
]

export default function Settings() {
  return (
    <PageWrapper type="stack" swipeBack backTo="/(tabs)/profile">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
          <BackButton icon="chevron-back" style={{ width: 36, height: 36, justifyContent: 'center' }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>Paramètres et confidentialité</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={{ backgroundColor: '#111', borderRadius: 12, overflow: 'hidden' }}>
            {CATEGORIES.map((item, i) => (
              <TouchableOpacity
                key={item.route}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.55}
                style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
                  borderBottomWidth: i < CATEGORIES.length - 1 ? 0.5 : 0,
                  borderBottomColor: '#222',
                }}
              >
                <Ionicons name={item.icon} size={22} color="#888" style={{ marginRight: 14 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.white, fontSize: 15 }}>{item.label}</Text>
                  <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#444" />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ color: '#444', fontSize: 12, textAlign: 'center', marginTop: 32, marginBottom: 16 }}>
            © 2026 Mbolo. Tous droits réservés.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </PageWrapper>
  )
}
