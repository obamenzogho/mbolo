/* CameraSideRail.tsx — Rail d'outils vertical gauche (clone caméra Instagram).

   Même anatomie que la caméra Instagram : rail d'icônes pures sur le bord
   gauche, verticalement centré. Les outils à options multiples (ratio,
   vitesse, minuterie, durée, qualité) ouvrent un panneau d'options en bas
   (pattern Instagram : l'icône ouvre un sheet) ; les toggles (grille,
   miroir, stab) basculent directement. Une icône est mise en évidence
   quand son réglage s'écarte de la valeur par défaut. */

import { memo } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useI18n } from '@/i18n'
import { cameraColors, createMotion } from '../../theme/createTokens'

/** Outils ouvrant un panneau d'options bas. */
export type ToolSheetId = 'ratio' | 'speed' | 'timer' | 'duration' | 'quality'

interface CameraSideRailProps {
  /** La grille de composition est active. */
  showGrid: boolean
  onToggleGrid: () => void
  /** Caméra frontale active : seul cas où le miroir est pertinent. */
  showMirror: boolean
  mirrorSelfie: boolean
  onToggleMirror: () => void
  /** Stabilisation vidéo iOS active. */
  videoStabilization: boolean
  onToggleVideoStabilization: () => void
  /** Un réglage s'écarte de sa valeur par défaut : icône en évidence. */
  ratioActive: boolean
  speedActive: boolean
  timerActive: boolean
  durationActive: boolean
  qualityActive: boolean
  /** Valeurs courantes, injectées dans les labels d'accessibilité. */
  ratioLabel: string
  speedLabel: string
  timerLabel: string
  durationLabel: string
  qualityLabel: string
  /** Ouvre le panneau d'options correspondant. */
  onOpenSheet: (sheet: ToolSheetId) => void
}

function RailItem({
  onPress,
  accessibilityLabel,
  selected,
  icon,
  activeIcon,
}: {
  onPress: () => void
  accessibilityLabel: string
  /** Réglage actif (toggle basculé ou valeur hors défaut). */
  selected: boolean
  icon: keyof typeof Ionicons.glyphMap
  activeIcon?: keyof typeof Ionicons.glyphMap
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.item,
        selected && styles.itemActive,
        pressed && styles.itemPressed,
      ]}
    >
      <Ionicons
        name={selected && activeIcon ? activeIcon : icon}
        size={22}
        color={
          selected ? cameraColors.chipContentActive : cameraColors.chipContentIdle
        }
      />
    </Pressable>
  )
}

function CameraSideRailComponent({
  showGrid,
  onToggleGrid,
  showMirror,
  mirrorSelfie,
  onToggleMirror,
  videoStabilization,
  onToggleVideoStabilization,
  ratioActive,
  speedActive,
  timerActive,
  durationActive,
  qualityActive,
  ratioLabel,
  speedLabel,
  timerLabel,
  durationLabel,
  qualityLabel,
  onOpenSheet,
}: CameraSideRailProps) {
  const { t } = useI18n()

  /* La qualité vidéo n'existe que sur Android, la stabilisation que sur iOS :
     expo-camera ne les expose pas sur l'autre plateforme. L'UI ne présente
     que ce que le capteur local sait faire. */
  const showVideoQuality = Platform.OS === 'android'
  const showVideoStabilization = Platform.OS === 'ios'

  return (
    <View style={styles.rail}>
      <RailItem
        accessibilityLabel={t.news.compose.a11yGrid}
        selected={showGrid}
        icon="grid-outline"
        activeIcon="grid"
        onPress={onToggleGrid}
      />

      <RailItem
        accessibilityLabel={t.news.compose.a11yAspectRatio.replace('{label}', ratioLabel)}
        selected={ratioActive}
        icon="crop-outline"
        onPress={() => onOpenSheet('ratio')}
      />

      <RailItem
        accessibilityLabel={t.news.compose.a11yCaptureSpeed.replace('{label}', speedLabel)}
        selected={speedActive}
        icon="speedometer-outline"
        onPress={() => onOpenSheet('speed')}
      />

      <RailItem
        accessibilityLabel={t.news.compose.a11yTimerDelay.replace('{label}', timerLabel)}
        selected={timerActive}
        icon="timer-outline"
        activeIcon="timer"
        onPress={() => onOpenSheet('timer')}
      />

      <RailItem
        accessibilityLabel={t.news.compose.a11yMaxDuration.replace('{label}', durationLabel)}
        selected={durationActive}
        icon="time-outline"
        onPress={() => onOpenSheet('duration')}
      />

      {showVideoQuality ? (
            <RailItem
              accessibilityLabel={t.news.compose.a11yVideoQuality.replace('{label}', qualityLabel)}
              selected={qualityActive}
              icon="videocam-outline"
              onPress={() => onOpenSheet('quality')}
            />
          ) : null}

      {showVideoStabilization ? (
        <RailItem
          accessibilityLabel={t.news.compose.a11yVideoStabilization}
          selected={videoStabilization}
          icon="pulse-outline"
          activeIcon="pulse"
          onPress={onToggleVideoStabilization}
        />
      ) : null}

      {showMirror ? (
        <RailItem
          accessibilityLabel={t.news.compose.a11yMirrorSelfie}
          selected={mirrorSelfie}
          icon="person-outline"
          activeIcon="person"
          onPress={onToggleMirror}
        />
      ) : null}
    </View>
  )
}

export const CameraSideRail = memo(CameraSideRailComponent)

const styles = StyleSheet.create({
  rail: {
    alignItems: 'center',
    gap: 14,
  },
  item: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: cameraColors.chipIdle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActive: {
    backgroundColor: cameraColors.chipActive,
  },
  itemPressed: {
    opacity: createMotion.pressedOpacity,
  },
})
