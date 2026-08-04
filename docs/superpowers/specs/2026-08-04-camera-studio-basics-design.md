# Camera Studio — Catégorie 1 : Fonctions de base

**Date** : 2026-08-04
**Status** : Draft
**Parent** : Camera Studio TikTok/Instagram

## Contexte

La caméra actuelle (`ComposeCamera`) gère photo/vidéo, flash, switch, timer et durée. Elle doit évoluer vers un studio de création complet (style TikTok). Cette spec couvre uniquement les **fonctions de base indispensables**.

## Objectif

Transformer `ComposeCamera` en une caméra studio professionnelle avec : ratio d'aspect, zoom pince, grid of thirds, mode rafale, vitesse de capture, et pause/reprise vidéo améliorée.

## Ce qui existe déjà

- `ComposeCamera.tsx` : photo/vidéo, flash (on/off), switch caméra, timer (3s/10s), durée max (15s/30s/60s), compteur enregistrement
- `expo-camera` : `CameraView` avec props `facing`, `flash`, `mode`
- `expo-image-manipulator` : disponible pour crops temps réel

## Fonctionnalités à implémenter

### 1. Ratio d'aspect

Sélecteur horizontal au-dessus du bouton shutter. Options :
- **9:16** (défaut, plein écran vertical)
- **1:1** (carré)
- **4:5** (portrait Instagram)
- **16:9** (paysage)
- **Original** (ratio natif de la caméra)

**Implémentation** : Masque overlay (View noire avec un trous au centre) positionné par-dessus `CameraView`. Le ratio est passé au `ComposeCamera` comme prop, appliqué au conteneur de la caméra.

**Interface :**
```typescript
type AspectRatioValue = '9:16' | '1:1' | '4:5' | '16:9' | 'original'
```

**Comportement** :
- Le masque est semi-transparent (couleur noire à 60% d'opacité)
- Le centre du ratio est centré verticalement
- Le switch de ratio ne redémarre pas la session caméra

### 2. Zoom pince (pinch-to-zoom)

Gesture handler sur la preview caméra.

**Implémentation** :
- `PinchGestureHandler` de `react-native-gesture-handler` enveloppant `CameraView`
- Prop `zoom` de `CameraView` pilotée par le geste
- Indicateur visuel : bulle centrale affichant le facteur (0.5x, 1x, 2x, 3x)
- Double-tap = reset à 1x
- Limite : 0.5x (ultra-wide si dispo) → 10x (digital)

**Interface :**
```typescript
const [zoom, setZoom] = useState(1)
// CameraView : <CameraView zoom={zoom} ... />
```

### 3. Grid of thirds

Overlay de grille de composition (2 lignes × 2 colonnes).

**Implémentation** :
- 4 lignes (`View` avec `borderBottomWidth: 1`, couleur blanche à 20% d'opacité)
- Toggle par un bouton dans la barre d'outils
- État persisté en `AsyncStorage` (préférence utilisateur)
- `pointerEvents="none"` pour ne pas intercepter les touches

### 4. Mode rafale (burst)

Capture multiple en maintenant le bouton shutter.

**Implémentation** :
- `onLongPress` sur le shutter déclenche la rafale
- `setInterval` à 150ms → `takePictureAsync()` à chaque tick
- Compteur affiché au-dessus du shutter (nombre de photos)
- `onPressOut` arrête la rafale
- Limite : 10 photos max
-振动 haptique à chaque capture

**Interface :**
```typescript
const [burstCount, setBurstCount] = useState(0)
const [isBursting, setIsBursting] = useState(false)
```

**Retour** : Tableau `SelectedMedia[]` au lieu d'un seul média.

### 5. Vitesse de capture vidéo

Sélecteur de vitesse d'enregistrement.

**Options** : 0.3x, 0.5x, 1x, 2x, 3x

**Implémentation** :
- La vitesse est stockée comme metadata, pas appliquée pendant l'enregistrement
- Au rendu final (FFmpeg), la vitesse est appliquée via le filtre `setpts` :
  - 0.3x : `setpts=3.33*PTS`
  - 0.5x : `setpts=2*PTS`
  - 1x : pas de filtre
  - 2x : `setpts=0.5*PTS`
  - 3x : `setpts=0.333*PTS`
- Audio : même logique avec `atempo` (limité à 0.5x-2x nativement, chainé au-delà)

**Interface :**
```typescript
type CaptureSpeed = '0.3' | '0.5' | '1' | '2' | '3'
```

### 6. Pause/reprise vidéo

Amélioration du flux d'enregistrement vidéo existant.

**Comportement actuel** : recordAsync → stopRecording → callback

**Nouveau comportement** :
- Bouton shutter = pause/reprise (icône pause pendant enregistrement)
- Barre de progression en haut pendant enregistrement
- Multiple segments supportés (reprise = nouveau segment, concaténés au rendu)
- Timer affiché en haut à gauche

## Architecture

### Fichiers modifiés
- `src/features/news/components/compose/ComposeCamera.tsx` — ajout zoom, grid, ratio, burst, speed, pause
- `src/features/create/types/editing.ts` — types `CaptureSpeed`, `AspectRatioValue`

### Fichiers créés
- `src/features/create/components/camera/CameraOverlay.tsx` — grid + ratio mask + zoom indicator
- `src/features/create/components/camera/CameraToolbar.tsx` — barre d'outils (ratio, speed, grid, duration)

### Dépendances
- `react-native-gesture-handler` (déjà installé) — pinch gesture
- `@react-native-async-storage/async-storage` (déjà installé) — préférences grid

## UI Layout (caméra studio)

```
┌──────────────────────────────────┐
│  [flash] [grid] [timer] [flip]  │  ← topBar existant
│                                  │
│         CameraView               │
│    ┌────────────────────┐        │
│    │    ratio mask      │        │
│    │   ┌──────────┐    │        │
│    │   │  preview  │    │        │
│    │   └──────────┘    │        │
│    └────────────────────┘        │
│                                  │
│   [zoom indicator: 1.0x]        │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 9:16  1:1  4:5  16:9      │  │  ← CameraToolbar
│  │  0.3x  0.5x  [1x]  2x 3x │  │
│  └────────────────────────────┘  │
│                                  │
│        [○ shutter]               │  ← existant
│   [photo] [video] [burst]       │
└──────────────────────────────────┘
```

## Cas spéciaux

- **Mode photo** : rafale disponible, vitesse désactivée
- **Mode vidéo** : rafale désactivée, vitesse disponible
- **Timer actif** : rafale désactivée pendant le countdown
- **Zoom** : désactivé pendant l'enregistrement vidéo (limite technique CameraView)

## Tests

- Test unitaire : ratio mask calculate correct overlay dimensions
- Test unitaire : burst intervalle et limite
- Test unitaire : speed metadata stockée correctement
- Test visuel : grid overlay affiché/masqué au toggle
- Test visuel : zoom gesture fluid
