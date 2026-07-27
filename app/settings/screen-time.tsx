import { useMemo } from 'react'
import { View, Text } from 'react-native'
import { useState } from 'react'
import { SettingsScreen, SettingsSection, SettingsRow, SettingsOptionSheet, type SettingsOption } from '@/features/settings/components'
import { useSettings } from '@/features/settings/SettingsProvider'
import { colors } from '@/lib/theme'

const LIMIT_OPTIONS: SettingsOption<number>[] = [
  { value: 0, label: 'Aucune limite' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 heure' },
  { value: 120, label: '2 heures' },
  { value: 180, label: '3 heures' },
]

const BREAK_OPTIONS: SettingsOption<number>[] = [
  { value: 30, label: 'Toutes les 30 minutes' },
  { value: 60, label: 'Toutes les heures' },
  { value: 120, label: 'Toutes les 2 heures' },
]

function formatLimit(min: number): string {
  if (!min) return 'Aucune'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m}` : `${h} h`
}

export default function ScreenTimeSettings() {
  const { settings, update } = useSettings()
  const st = settings.screenTime
  const [limitSheet, setLimitSheet] = useState(false)
  const [breakSheet, setBreakSheet] = useState(false)

  const limitLabel = useMemo(() => formatLimit(st.dailyLimitMinutes), [st.dailyLimitMinutes])
  const breakLabel = useMemo(
    () => BREAK_OPTIONS.find((o) => o.value === st.breakIntervalMinutes)?.label ?? '—',
    [st.breakIntervalMinutes],
  )

  return (
    <SettingsScreen title="Temps d'utilisation">
      <View style={{ backgroundColor: '#111', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ color: colors.primary, fontSize: 40, fontWeight: '800' }}>—</Text>
        <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
          Suivi quotidien bientôt disponible
        </Text>
      </View>

      <SettingsSection
        title="Limites"
        footer="MBolo t'aide à garder un usage équilibré. Les rappels s'affichent dans l'app."
      >
        <SettingsRow
          icon="hourglass-outline"
          label="Limite quotidienne"
          description="Reçois une alerte quand tu atteins ce temps"
          kind="value"
          value={limitLabel}
          onPress={() => setLimitSheet(true)}
          divider
        />
        <SettingsRow
          icon="notifications-outline"
          label="Rappel quotidien"
          description="Un résumé de ton temps passé chaque jour"
          kind="toggle"
          toggleValue={st.dailyReminderEnabled}
          onToggle={(v) => update('screenTime.dailyReminderEnabled', v)}
        />
      </SettingsSection>

      <SettingsSection title="Pauses">
        <SettingsRow
          icon="cafe-outline"
          label="Rappels de pause"
          description="Une invitation à faire une pause régulièrement"
          kind="toggle"
          toggleValue={st.breakRemindersEnabled}
          onToggle={(v) => update('screenTime.breakRemindersEnabled', v)}
          divider
        />
        <SettingsRow
          icon="time-outline"
          label="Fréquence des pauses"
          kind="value"
          value={breakLabel}
          onPress={() => setBreakSheet(true)}
          disabled={!st.breakRemindersEnabled}
        />
      </SettingsSection>

      <SettingsOptionSheet
        visible={limitSheet}
        title="Limite quotidienne"
        options={LIMIT_OPTIONS}
        selected={st.dailyLimitMinutes}
        onSelect={(v) => update('screenTime.dailyLimitMinutes', v)}
        onClose={() => setLimitSheet(false)}
      />
      <SettingsOptionSheet
        visible={breakSheet}
        title="Fréquence des pauses"
        options={BREAK_OPTIONS}
        selected={st.breakIntervalMinutes}
        onSelect={(v) => update('screenTime.breakIntervalMinutes', v)}
        onClose={() => setBreakSheet(false)}
      />
    </SettingsScreen>
  )
}
