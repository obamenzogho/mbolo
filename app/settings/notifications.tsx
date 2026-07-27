import { useState, useEffect, useCallback } from 'react'
import { Alert, Linking } from 'react-native'
import * as Notifications from 'expo-notifications'
import { SettingsScreen, SettingsSection, SettingsRow } from '@/features/settings/components'
import { useSettings } from '@/features/settings/SettingsProvider'

export default function NotificationsSettings() {
  const { settings, update } = useSettings()
  const n = settings.notifications
  const [systemGranted, setSystemGranted] = useState<boolean | null>(null)

  const refreshPermission = useCallback(() => {
    Notifications.getPermissionsAsync()
      .then((p: any) => setSystemGranted(p.status === 'granted'))
      .catch(() => setSystemGranted(null))
  }, [])

  useEffect(() => { refreshPermission() }, [refreshPermission])

  const requestPermission = async () => {
    const current = await Notifications.getPermissionsAsync() as any
    if (current.status === 'granted') { setSystemGranted(true); return }
    if (current.canAskAgain) {
      const res = await Notifications.requestPermissionsAsync() as any
      setSystemGranted(res.status === 'granted')
    } else {
      Alert.alert(
        'Notifications désactivées',
        'Active les notifications pour MBolo dans les réglages de ton téléphone.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Ouvrir les réglages', onPress: () => Linking.openSettings() },
        ],
      )
    }
  }

  // Sous-catégories désactivées si l'interrupteur maître est coupé.
  const masterOff = !n.enabled
  const catRow = (
    icon: any,
    label: string,
    key: keyof typeof n,
  ) => (
    <SettingsRow
      icon={icon}
      label={label}
      kind="toggle"
      divider
      disabled={masterOff}
      toggleValue={n[key] as boolean}
      onToggle={(v) => update(`notifications.${key}`, v)}
    />
  )

  return (
    <SettingsScreen title="Notifications">
      {systemGranted === false ? (
        <SettingsSection footer="Les notifications système sont désactivées. Sans autorisation, MBolo ne peut envoyer aucune notification push.">
          <SettingsRow
            icon="warning-outline"
            label="Autoriser les notifications"
            description="Requis au niveau du système"
            kind="action"
            onPress={requestPermission}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection title="Général">
        <SettingsRow
          icon="notifications-outline"
          label="Notifications push"
          description="Interrupteur principal pour toutes les notifications"
          kind="toggle"
          toggleValue={n.enabled}
          onToggle={(v) => update('notifications.enabled', v)}
        />
      </SettingsSection>

      <SettingsSection title="Activité" footer={masterOff ? 'Active les notifications push pour choisir les catégories.' : undefined}>
        {catRow('heart-outline', "J'aime", 'likes')}
        {catRow('chatbubble-outline', 'Commentaires', 'comments')}
        {catRow('person-add-outline', 'Nouveaux abonnés', 'follows')}
        {catRow('at-outline', 'Mentions', 'mentions')}
        {catRow('repeat-outline', 'Republications', 'reposts')}
        <SettingsRow
          icon="mail-outline"
          label="Messages"
          kind="toggle"
          disabled={masterOff}
          toggleValue={n.messages}
          onToggle={(v) => update('notifications.messages', v)}
        />
      </SettingsSection>

      <SettingsSection title="MBolo">
        <SettingsRow
          icon="megaphone-outline"
          label="Annonces et nouveautés"
          description="Actualités produit et conseils"
          kind="toggle"
          disabled={masterOff}
          toggleValue={n.fromMbolo}
          onToggle={(v) => update('notifications.fromMbolo', v)}
        />
      </SettingsSection>
    </SettingsScreen>
  )
}
