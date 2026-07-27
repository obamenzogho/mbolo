import { useState } from 'react'
import { SettingsScreen, SettingsSection, SettingsRow, SettingsOptionSheet, type SettingsOption } from '@/features/settings/components'
import { useSettings } from '@/features/settings/SettingsProvider'
import type { TextSize } from '@/features/settings/types'

const TEXT_SIZE_OPTIONS: SettingsOption<TextSize>[] = [
  { value: 'small', label: 'Petite' },
  { value: 'default', label: 'Standard' },
  { value: 'large', label: 'Grande' },
  { value: 'xlarge', label: 'Très grande' },
]

const TEXT_SIZE_LABEL: Record<TextSize, string> = {
  small: 'Petite',
  default: 'Standard',
  large: 'Grande',
  xlarge: 'Très grande',
}

export default function AccessibilitySettings() {
  const { settings, update } = useSettings()
  const a11y = settings.accessibility
  const [sizeSheet, setSizeSheet] = useState(false)

  return (
    <SettingsScreen title="Accessibilité">
      <SettingsSection title="Affichage" footer="Ces réglages sont synchronisés sur tous tes appareils.">
        <SettingsRow
          icon="text-outline"
          label="Taille du texte"
          kind="value"
          value={TEXT_SIZE_LABEL[a11y.textSize]}
          onPress={() => setSizeSheet(true)}
          divider
        />
        <SettingsRow
          icon="contrast-outline"
          label="Contraste élevé"
          description="Renforce la lisibilité des textes et bordures"
          kind="toggle"
          toggleValue={a11y.highContrast}
          onToggle={(v) => update('accessibility.highContrast', v)}
        />
      </SettingsSection>

      <SettingsSection title="Mouvement & médias">
        <SettingsRow
          icon="pause-circle-outline"
          label="Réduire les animations"
          description="Limite les transitions et effets de mouvement"
          kind="toggle"
          toggleValue={a11y.reduceMotion}
          onToggle={(v) => update('accessibility.reduceMotion', v)}
          divider
        />
        <SettingsRow
          icon="chatbox-ellipses-outline"
          label="Sous-titres automatiques"
          description="Affiche les sous-titres quand ils sont disponibles"
          kind="toggle"
          toggleValue={a11y.autoCaptions}
          onToggle={(v) => update('accessibility.autoCaptions', v)}
        />
      </SettingsSection>

      <SettingsOptionSheet
        visible={sizeSheet}
        title="Taille du texte"
        options={TEXT_SIZE_OPTIONS}
        selected={a11y.textSize}
        onSelect={(v) => update('accessibility.textSize', v)}
        onClose={() => setSizeSheet(false)}
      />
    </SettingsScreen>
  )
}
