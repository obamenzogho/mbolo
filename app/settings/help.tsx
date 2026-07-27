import { useState } from 'react'
import { Alert, Linking } from 'react-native'
import { router } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { SettingsScreen, SettingsSection, SettingsRow } from '@/features/settings/components'

const SUPPORT_EMAIL = 'support@mbolo.app'

const FAQ: { q: string; a: string }[] = [
  { q: 'Comment publier une vidéo ?', a: "Depuis l'onglet central (+), choisis une vidéo ou filme, ajoute une description puis publie." },
  { q: 'Comment passer mon compte en privé ?', a: 'Paramètres → Confidentialité → Compte privé. Seuls tes abonnés verront alors tes vidéos.' },
  { q: 'Comment bloquer un utilisateur ?', a: "Ouvre son profil, appuie sur le menu (•••) puis « Bloquer »." },
  { q: 'Comment supprimer mon compte ?', a: 'Paramètres → Compte → Supprimer mon compte. Cette action est irréversible.' },
]

export default function HelpSettings() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const contactSupport = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Support MBolo')}`
    const canOpen = await Linking.canOpenURL(url).catch(() => false)
    if (canOpen) {
      Linking.openURL(url)
    } else {
      await Clipboard.setStringAsync(SUPPORT_EMAIL)
      Alert.alert('Email copié', `Écris-nous à ${SUPPORT_EMAIL}`)
    }
  }

  const reportProblem = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Signalement de problème — MBolo')}`
    const canOpen = await Linking.canOpenURL(url).catch(() => false)
    if (canOpen) Linking.openURL(url)
    else Alert.alert('Nous contacter', `Écris-nous à ${SUPPORT_EMAIL}`)
  }

  return (
    <SettingsScreen title="Centre d'aide">
      <SettingsSection title="Questions fréquentes">
        {FAQ.map((item, i) => (
          <SettingsRow
            key={i}
            icon={openFaq === i ? 'chevron-down-outline' : 'help-circle-outline'}
            label={item.q}
            description={openFaq === i ? item.a : undefined}
            kind="static"
            onPress={() => setOpenFaq(openFaq === i ? null : i)}
            divider={i < FAQ.length - 1}
          />
        ))}
      </SettingsSection>

      <SettingsSection title="Nous contacter">
        <SettingsRow
          icon="mail-outline"
          label="Contacter le support"
          description={SUPPORT_EMAIL}
          onPress={contactSupport}
          divider
        />
        <SettingsRow
          icon="flag-outline"
          label="Signaler un problème"
          onPress={reportProblem}
        />
      </SettingsSection>

      <SettingsSection title="À propos & légal">
        <SettingsRow
          icon="information-circle-outline"
          label="À propos de MBolo"
          onPress={() => router.push('/settings/about')}
          divider
        />
        <SettingsRow
          icon="document-text-outline"
          label="Conditions d'utilisation"
          onPress={() => router.push('/legal/terms')}
          divider
        />
        <SettingsRow
          icon="shield-checkmark-outline"
          label="Politique de confidentialité"
          onPress={() => router.push('/legal/privacy')}
        />
      </SettingsSection>
    </SettingsScreen>
  )
}
