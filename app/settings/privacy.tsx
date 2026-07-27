import { useState } from 'react'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import {
  SettingsScreen,
  SettingsSection,
  SettingsRow,
  SettingsOptionSheet,
  type SettingsOption,
} from '@/features/settings/components'
import { useSettings } from '@/features/settings/SettingsProvider'
import type { Audience } from '@/features/settings/types'

const AUDIENCE_OPTIONS: SettingsOption<Audience>[] = [
  { value: 'everyone', label: 'Tout le monde' },
  { value: 'followers', label: 'Mes abonnés' },
  { value: 'nobody', label: 'Personne' },
]

const AUDIENCE_LABELS: Record<Audience, string> = {
  everyone: 'Tout le monde',
  followers: 'Mes abonnés',
  nobody: 'Personne',
}

type AudienceKey = 'whoCanComment' | 'whoCanMention' | 'whoCanRepost' | 'whoCanMessage' | 'storyAudience'

export default function PrivacySettings() {
  const { settings, update } = useSettings()
  const pv = settings.privacy
  const [sheet, setSheet] = useState<{ key: AudienceKey; title: string } | null>(null)

  const audienceRow = (key: AudienceKey, icon: any, label: string) => (
    <SettingsRow
      icon={icon}
      label={label}
      kind="value"
      value={AUDIENCE_LABELS[pv[key]]}
      onPress={() => setSheet({ key, title: label })}
      divider={key !== 'whoCanMessage'}
    />
  )

  return (
    <SettingsScreen title="Confidentialité">
      <SettingsSection title="Compte" footer="En compte privé, seuls tes abonnés acceptés voient tes vidéos.">
        <SettingsRow
          icon="lock-closed-outline"
          label="Compte privé"
          description="Seuls tes abonnés peuvent voir tes vidéos"
          kind="toggle"
          toggleValue={pv.privateAccount}
          onToggle={(v) => update('privacy.privateAccount', v)}
        />
      </SettingsSection>

      <SettingsSection title="Interactions">
        {audienceRow('whoCanComment', 'chatbubble-outline', 'Qui peut commenter')}
        {audienceRow('whoCanMention', 'at-outline', 'Qui peut me mentionner')}
        {audienceRow('whoCanRepost', 'repeat-outline', 'Qui peut republier')}
        {audienceRow('whoCanMessage', 'mail-outline', 'Qui peut m\'envoyer un message')}
      </SettingsSection>

      <SettingsSection title="Visibilité">
        <SettingsRow
          icon="ellipse-outline"
          label="Statut d'activité"
          description="Montrer quand tu es en ligne"
          kind="toggle"
          toggleValue={pv.showActivityStatus}
          onToggle={(v) => update('privacy.showActivityStatus', v)}
          divider
        />
        <SettingsRow
          icon="calendar-outline"
          label="Afficher mon âge"
          description="Visible sur ton profil public"
          kind="toggle"
          toggleValue={pv.showAge}
          onToggle={(v) => update('privacy.showAge', v)}
        />
      </SettingsSection>

      <SettingsSection title="Modération">
        <SettingsRow
          icon="text-outline"
          label="Mots bloqués"
          description="Masquer les commentaires contenant ces mots"
          kind="action"
          onPress={() => router.push('/settings/blocked-words')}
        />
      </SettingsSection>

      <SettingsSection title="Stories" footer="Contrôle qui peut voir tes stories.">
        {audienceRow('storyAudience', 'eye-outline', 'Qui peut voir mes stories')}
        <SettingsRow
          icon="person-remove-outline"
          label="Exclure des utilisateurs"
          description={pv.storyExcludedUsers.length > 0 ? `${pv.storyExcludedUsers.length} utilisateur(s) exclus` : 'Aucun utilisateur exclu'}
          kind="action"
          onPress={() => Alert.alert('Bientôt', 'La sélection d\'utilisateurs à exclure arrive prochainement.')}
        />
      </SettingsSection>

      <SettingsOptionSheet
        visible={!!sheet}
        title={sheet?.title ?? ''}
        options={AUDIENCE_OPTIONS}
        selected={sheet ? pv[sheet.key] : 'everyone'}
        onSelect={(v) => sheet && update(`privacy.${sheet.key}`, v)}
        onClose={() => setSheet(null)}
      />
    </SettingsScreen>
  )
}
