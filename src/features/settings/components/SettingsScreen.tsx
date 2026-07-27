import { View, Text, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import PageWrapper from '@/components/PageWrapper'
import { BackButton } from '@/components/ui/BackButton'
import { colors } from '@/lib/theme'

interface SettingsScreenProps {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

/**
 * Squelette commun à tous les écrans Paramètres : animation d'entrée, header
 * avec bouton retour centré, fond noir, ScrollView. Garantit une cohérence
 * visuelle stricte entre les 9 sections sans dupliquer le layout.
 */
export function SettingsScreen({ title, children, footer }: SettingsScreenProps) {
  return (
    <PageWrapper type="slideRight">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: 0.5,
            borderBottomColor: '#222',
          }}
        >
          <BackButton icon="chevron-back" style={{ width: 36, height: 36, justifyContent: 'center' }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontSize: 17, fontWeight: '700' }}>{title}</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {children}
          {footer}
        </ScrollView>
      </SafeAreaView>
    </PageWrapper>
  )
}
