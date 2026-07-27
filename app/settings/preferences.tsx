import { useState } from 'react'
import {
  SettingsScreen,
  SettingsSection,
  SettingsRow,
  SettingsOptionSheet,
  type SettingsOption,
} from '@/features/settings/components'
import { useSettings } from '@/features/settings/SettingsProvider'
import type { ThemeMode, VideoQuality } from '@/features/settings/types'

const THEME_OPTIONS: SettingsOption<ThemeMode>[] = [
  { value: 'dark', label: 'Sombre', description: 'Thème par défaut de MBolo' },
  { value: 'light', label: 'Clair' },
  { value: 'system', label: 'Système', description: 'Suit les réglages de ton appareil' },
]

const QUALITY_OPTIONS: SettingsOption<VideoQuality>[] = [
  { value: 'auto', label: 'Automatique', description: 'Selon ta connexion' },
  { value: 'high', label: 'Haute qualité' },
  { value: 'data-saver', label: 'Économie de données', description: 'Qualité réduite' },
]

const THEME_LABELS: Record<ThemeMode, string> = { dark: 'Sombre', light: 'Clair', system: 'Système' }
const QUALITY_LABELS: Record<VideoQuality, string> = { auto: 'Automatique', high: 'Haute qualité', 'data-saver': 'Économie de données' }

export default function PreferencesSettings() {
  const { settings, update } = useSettings()
  const p = settings.preferences
  const [themeOpen, setThemeOpen] = useState(false)
  const [qualityOpen, setQualityOpen] = useState(false)

  return (
    <SettingsScreen title="Préférences">
      <SettingsSection title="Apparence">
        <SettingsRow
          icon="contrast-outline"
          label="Thème"
          kind="value"
          value={THEME_LABELS[p.theme]}
          onPress={() => setThemeOpen(true)}
        />
      </SettingsSection>

      <SettingsSection title="Lecture" footer="La lecture automatique et la qualité s'appliquent au fil de vidéos.">
        <SettingsRow
          icon="play-circle-outline"
          label="Lecture automatique"
          description="Lance les vidéos en faisant défiler"
          kind="toggle"
          toggleValue={p.autoplay}
          onToggle={(v) => update('preferences.autoplay', v)}
          divider
        />
        <SettingsRow
          icon="videocam-outline"
          label="Qualité vidéo"
          kind="value"
          value={QUALITY_LABELS[p.videoQuality]}
          onPress={() => setQualityOpen(true)}
          divider
        />
        <SettingsRow
          icon="leaf-outline"
          label="Économie de données"
          description="Réduit la qualité pour consommer moins"
          kind="toggle"
          toggleValue={p.dataSaver}
          onToggle={(v) => update('preferences.dataSaver', v)}
        />
      </SettingsSection>

      <SettingsSection title="Retour haptique">
        <SettingsRow
          icon="phone-portrait-outline"
          label="Vibrations"
          description="Retour tactile lors des interactions"
          kind="toggle"
          toggleValue={p.hapticsEnabled}
          onToggle={(v) => update('preferences.hapticsEnabled', v)}
        />
      </SettingsSection>

      <SettingsOptionSheet
        visible={themeOpen}
        title="Thème"
        options={THEME_OPTIONS}
        selected={p.theme}
        onSelect={(v) => update('preferences.theme', v)}
        onClose={() => setThemeOpen(false)}
      />
      <SettingsOptionSheet
        visible={qualityOpen}
        title="Qualité vidéo"
        options={QUALITY_OPTIONS}
        selected={p.videoQuality}
        onSelect={(v) => update('preferences.videoQuality', v)}
        onClose={() => setQualityOpen(false)}
      />
    </SettingsScreen>
  )
}
