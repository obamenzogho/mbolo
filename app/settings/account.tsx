import { useState } from 'react'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import { signOut } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '@/lib/firebase'
import { useI18n } from '@/i18n/index'
import type { Language } from '@/i18n/index'
import {
  SettingsScreen,
  SettingsSection,
  SettingsRow,
  SettingsOptionSheet,
  type SettingsOption,
} from '@/features/settings/components'
import { useSettings } from '@/features/settings/SettingsProvider'

export default function AccountSettings() {
  const { settings, update } = useSettings()
  const { language, setLanguage, availableLanguages } = useI18n()
  const [langSheet, setLangSheet] = useState(false)
  const user = auth.currentUser

  const langOptions: SettingsOption<Language>[] = availableLanguages.map((l) => ({
    value: l.code,
    label: l.label,
  }))
  const currentLangLabel = availableLanguages.find((l) => l.code === language)?.label ?? 'Français'

  const accountTypeLabel = {
    personal: 'Personnel',
    creator: 'Créateur',
    business: 'Professionnel',
  }[settings.account.accountType]

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes tes données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await httpsCallable(functions, 'deleteAccount')()
              await signOut(auth)
              router.replace('/(auth)/login')
            } catch {
              Alert.alert('Erreur', 'Suppression impossible. Reconnecte-toi puis réessaie.')
            }
          },
        },
      ]
    )
  }

  return (
    <SettingsScreen title="Compte">
      <SettingsSection title="Profil">
        <SettingsRow
          icon="person-outline"
          label="Modifier le profil"
          description="Photo, nom, bio, liens"
          kind="action"
          onPress={() => router.push('/(tabs)/edit-profile')}
          divider
        />
        <SettingsRow
          icon="at-outline"
          label="Nom d'utilisateur"
          kind="action"
          onPress={() => router.push('/(tabs)/edit-profile')}
        />
      </SettingsSection>

      <SettingsSection title="Informations">
        <SettingsRow
          icon="mail-outline"
          label="Email"
          kind="static"
          description={user?.email ?? 'Non renseigné'}
          divider
        />
        <SettingsRow
          icon="briefcase-outline"
          label="Type de compte"
          kind="value"
          value={accountTypeLabel}
        />
      </SettingsSection>

      <SettingsSection title="Langue">
        <SettingsRow
          icon="language-outline"
          label="Langue de l'application"
          kind="value"
          value={currentLangLabel}
          onPress={() => setLangSheet(true)}
        />
      </SettingsSection>

      <SettingsSection title="Zone sensible" footer="La déconnexion se fait depuis le menu de ton profil.">
        <SettingsRow
          icon="trash-outline"
          label="Supprimer mon compte"
          description="Action définitive et irréversible"
          kind="action"
          destructive
          onPress={handleDeleteAccount}
        />
      </SettingsSection>

      <SettingsOptionSheet
        visible={langSheet}
        title="Langue"
        options={langOptions}
        selected={language}
        onSelect={(v) => setLanguage(v)}
        onClose={() => setLangSheet(false)}
      />
    </SettingsScreen>
  )
}
