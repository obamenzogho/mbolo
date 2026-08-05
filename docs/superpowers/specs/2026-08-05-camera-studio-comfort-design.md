# Camera Studio — Catégorie 2 : Confort, qualité et persistance

**Date** : 2026-08-05
**Status** : Draft
**Parent** : Camera Studio TikTok/Instagram

## Contexte

La catégorie 1 (fonctions de base) est livrée : ratio, zoom pince, grille, rafale, vitesse, pause/reprise segmentée, compte à rebours, sélecteur de musique. Cette catégorie couvre le **confort d'enregistrement et la qualité du rendu** : modes de flash complets, miroir selfie, qualité vidéo, stabilisation, sauvegarde dans la pellicule — plus la **persistance des préférences** (dont la grille, promise en catégorie 1 mais jamais persistée).

## Objectif

Toutes les préférences caméra survivent au redémarrage (AsyncStorage), le flash gagne le mode auto, la caméra frontale un miroir, et l'utilisateur contrôle la qualité vidéo et la stabilisation selon sa plateforme. Les prises peuvent être sauvegardées dans la pellicule du téléphone.

## Ce qui existe déjà

- `ComposeCamera.tsx` : flash on/off, switch caméra, timer, zoom pince (PanResponder), grille (non persistée), ratio, rafale, vitesse, pause/reprise segmentée
- `CameraToolbar.tsx` : chips ratio / vitesse / durée / grille
- `expo-camera 17` : `flash: 'off'|'on'|'auto'`, `mirror` (iOS, preview frontale), `videoQuality` (Android : `2160p|1080p|720p|480p|4:3`), `videoStabilizationMode` (iOS : `off|standard|cinematic`), `pictureSize` (Android : `high|medium|low`)
- `expo-media-library 18.2.1` : installé, non utilisé
- `@react-native-async-storage/async-storage` : installé

## Fonctionnalités à implémenter

### 1. Flash à trois états (off / on / auto)

L'appui sur l'icône cycle `off → on → auto → off`.

**Interface :**
```typescript
type FlashMode = 'off' | 'on' | 'auto'
```

**Comportement** :
- Icônes : `flash-off` (off), `flash` (on), `flash-outline` (auto — demi-charge, seule approximation disponible dans Ionicons)
- `accessibilityLabel` traduit par état, `accessibilityState.selected` pour `on`
- `auto` est un mode passif : la prévisualisation ne change pas
- Désactivé pendant l'enregistrement (l'appui ne doit pas dégrader une prise en cours)

### 2. Miroir selfie

Bouton dédié visible **uniquement en caméra frontale** (une vue est à l'endroit quand on la regarde, un miroir est le bon défaut).

**Implémentation** : prop `mirror` de `CameraView` pilotée par la préférence `mirrorSelfie`. Persistée.

**Comportement** :
- Caméra arrière : bouton masqué, valeur ignorée
- Caméra frontale : toggle visuel (icône `person` vs `person-outline` ou badge) — l'icône affiche l'état actif
- La valeur persiste au redémarrage, le retournement caméra ne la réinitialise pas

### 3. Qualité vidéo (Android)

Sélecteur de résolution d'enregistrement vidéo, **affiché uniquement sur Android** (iOS choisit la meilleure disponibilité).

**Options** : `720p` (léger, débit faible), `1080p` (défaut), `2160p` (4K, poids élevé)

**Interface :**
```typescript
type VideoQualityOption = '720p' | '1080p' | '2160p'
```

**Comportement** :
- Chips dans `CameraToolbar`, section vidéo uniquement, à côté de la vitesse
- `videoQuality` passé à `CameraView` ; si l'appareil ne la supporte pas, expo-camera choisit la meilleure disponible (documenté)
- Persistée

### 4. Stabilisation vidéo (iOS)

Toggle `on/off`, **affiché uniquement sur iOS** (mode `videoStabilizationMode`).

**Implémentation** : `VideoStabilization.standard` quand actif (compromis qualité/fluidité), `off` sinon. `cinematic` est réservé à une future évolution (déformation de bords plus marquée).

**Comportement** :
- Chip unique dans `CameraToolbar` (section vidéo, iOS) : libellé « stab » + état
- Persistée

### 5. Sauvegarde dans la pellicule

Préférence « Enregistrer dans l'appareil photo » : chaque prise réussie (photo, rafale, vidéo finalisée) est copiée dans la pellicule du téléphone.

**Implémentation** : `expo-media-library` — `getPermissionsAsync()` → `requestPermissionsAsync()` à la première activation ; `saveToLibraryAsync(uri)` en fire-and-forget avec gestion d'erreur réelle (permission refusée → désactivation du toggle + message, échec d'écriture → `captureException`).

**Comportement** :
- Toggle persisté dans les préférences
- Photo : sauvegarde à la prise ; Rafale : sauvegarde de chaque cliché (best-effort, échec d'un cliché n'annule pas les autres) ; Vidéo : sauvegarde à la confirmation (avant `onCapture`)
- Ne bloque jamais le flux de création : échec ≠ blocage

### 6. Persistance des préférences caméra

**Nouveau hook** `src/features/create/hooks/useCameraPreferences.ts` :

```typescript
interface CameraPreferences {
  showGrid: boolean
  mirrorSelfie: boolean
  videoQuality: VideoQualityOption
  videoStabilization: boolean
  saveToLibrary: boolean
}
```

- Clé AsyncStorage unique `camera.preferences.v1` (versionnée, JSON typé)
- Chargement asynchrone au montage avec fallback aux défauts, écriture `setItem` sur chaque changement (fire-and-forget, erreur loggée `captureException`)
- Zéro re-render parasite : le hook expose un `useEffect` de persistance, pas un abonnement temps réel

**Rétro-compatibilité** : la grille est déjà un `useState` local dans `ComposeCamera` — elle est migrée vers le hook (le défaut reste `false`).

## Architecture

### Fichiers modifiés
- `src/features/news/components/compose/ComposeCamera.tsx` — flash 3 états, miroir, qualité, stabilisation, sauvegarde pellicule, grille persistée
- `src/features/create/components/camera/CameraToolbar.tsx` — chips qualité (Android) + stabilisation (iOS)
- `src/features/create/types/editing.ts` — types `FlashMode`, `VideoQualityOption`

### Fichiers créés
- `src/features/create/hooks/useCameraPreferences.ts` — chargement + persistance des préférences
- `src/features/create/hooks/__tests__/useCameraPreferences.test.ts` — cycle de vie du hook
- `src/features/create/utils/cameraRoll.ts` — wrapper `saveMediaToLibrary` (permissions + erreurs)

### Dépendances
- `expo-media-library` (installé)
- `@react-native-async-storage/async-storage` (installé)

## UI Layout

```
Top bar : [flash: off→on→auto] [miroir — frontale] [timer] [flip]

CameraToolbar (vidéo) : 9:16 1:1 4:5 16:9  |  0.3x 0.5x 1x 2x 3x  |  720p 1080p 2160p (Android)  |  [stab] (iOS)  |  0s 3s 10s  |  15s 30s 60s
```

## Cas spéciaux

- **Mode photo** : qualité/stabilisation masquées, miroir/flash/sauvegarde actifs
- **Caméra frontale + flash** : flash indisponible sur la plupart des frontales → bouton désactivé visuellement (opacité), pas de cycle silencieux
- **Enregistrement en cours** : flash et miroir non interactifs (le rendu en cours ne doit pas être modifié)
- **Android ≤ 12 / permission pellicule** : demande au premier toggle, refus → toggle désactivé + message i18n
- **RAF** : sauvegarde best-effort par cliché, compteur non bloqué par les écritures disque
- **Web** : `saveToLibraryAsync` indisponible → toggle masqué sur web

## Tests

- Test unitaire : cycle flash off→on→auto→off
- Test unitaire : préférences — chargement avec fallback défauts, écriture JSON versionnée
- Test unitaire : `saveMediaToLibrary` — permission refusée → `false` sans throw, succès → `true`
- Test manuel : grille persistée après kill de l'app, miroir selfie, qualité 1080p/4K sur Android, stab iOS

## Hors périmètre

- Beauté / filtres temps réel (nécessite un module natif dédié — future catégorie)
- Retournement de caméra en cours d'enregistrement (limitation expo-camera)
- Photo pendant vidéo (limitation expo-camera)
