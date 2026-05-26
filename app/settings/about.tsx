import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../src/lib/theme'
import { router } from 'expo-router'

export default function About() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 36, height: 36, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>À propos</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>M</Text>
        </View>
        <Text style={{ color: colors.white, fontSize: 24, fontWeight: '800', marginBottom: 4 }}>Mbolo</Text>
        <Text style={{ color: '#888', fontSize: 14, marginBottom: 32 }}>Version 1.0.0</Text>

        <Text style={{ color: colors.white, fontSize: 15, lineHeight: 24, textAlign: 'center', marginBottom: 32 }}>
          Mbolo est le réseau social gabonais qui connecte les talents du Gabon avec le monde entier.
          Partage tes vidéos, découvre des créateurs et exprime-toi librement. 🇬🇦
        </Text>

        <View style={{ width: '100%' }}>
          {[
            { label: 'Développé par', value: 'Équipe Mbolo' },
            { label: 'Contact', value: 'support@mbolo.app' },
            { label: 'Site web', value: 'https://mbolo.app' },
            { label: 'Licence', value: 'Propriétaire' },
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#222' }}>
              <Text style={{ color: '#888', fontSize: 14 }}>{item.label}</Text>
              <Text style={{ color: colors.white, fontSize: 14 }}>{item.value}</Text>
            </View>
          ))}
        </View>

        <Text style={{ color: '#444', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
          © 2026 Mbolo. Tous droits réservés.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
