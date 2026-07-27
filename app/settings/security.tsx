import { useState } from 'react'
import { Alert } from 'react-native'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useSettings } from '@/features/settings/SettingsProvider'
import { SettingsScreen, SettingsSection, SettingsRow } from '@/features/settings/components'

export default function SecuritySettings() {
  const { settings, update } = useSettings()
  const s = settings.security
  const [sending, setSending] = useState(false)

  const handlePasswordReset = () => {
    const email = auth.currentUser?.email
    if (!email) {
      Alert.alert('Indisponible', 'Aucune adresse email associée à ce compte.')
      return
    }
    Alert.alert(
      'Changer le mot de passe',
      `Un lien de réinitialisation sera envoyé à ${email}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            setSending(true)
            try {
              await sendPasswordResetEmail(auth, email)
              Alert.alert('Email envoyé', 'Consulte ta boîte mail pour réinitialiser ton mot de passe.')
            } catch {
              Alert.alert('Erreur', 'Envoi impossible. Réessaie plus tard.')
            } finally {
              setSending(false)
            }
          },
        },
      ],
    )
  }

  return (
    <SettingsScreen title="Sécurité">
      <SettingsSection title="Connexion" footer="Un email de connexion inhabituelle t'aide à repérer un accès non autorisé.">
        <SettingsRow
          icon="notifications-circle-outline"
          label="Alertes de connexion"
          description="Être averti d'une connexion depuis un nouvel appareil"
          kind="toggle"
          toggleValue={s.loginAlerts}
          onToggle={(v) => update('security.loginAlerts', v)}
          divider
        />
        <SettingsRow
          icon="key-outline"
          label="Changer le mot de passe"
          description={sending ? 'Envoi en cours…' : 'Recevoir un lien de réinitialisation par email'}
          kind="action"
          onPress={handlePasswordReset}
          disabled={sending}
        />
      </SettingsSection>

      <SettingsSection title="Renforcer" footer="La double authentification arrive prochainement sur MBolo.">
        <SettingsRow
          icon="shield-checkmark-outline"
          label="Double authentification"
          description="Bientôt disponible"
          kind="value"
          value="À venir"
          disabled
        />
      </SettingsSection>
    </SettingsScreen>
  )
}
