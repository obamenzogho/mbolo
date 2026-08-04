# SelectScreen Instagram-Level Redesign

**Date** : 2026-08-04
**Status** : Approved
**Approach** : Refactor in-place (SelectScreen + GalleryGrid)

## Objectif

Transformer le `SelectScreen` du flow de création pour atteindre le niveau UX d'Instagram :
- Grille plein écran (pas d'aperçu au-dessus)
- Header compact avec album picker, modes de création, et toggle multi-sélection
- Sélection simple par défaut (tap → next), multi-sélection optionnelle (badges numérotés)

## Layout cible

```
┌─────────────────────────────────────────┐
│  Récents ▼    📷  ✏️         ⊞      │
│  [album] [caméra][texte]  [multi-sel] │
├─────────────────────────────────────────┤
│ ┌───┐ ┌───┐ ┌───┐ │
│ │   │ │   │ │   │ │
│ └───┘ └───┘ └───┘ │
│ ┌───┐ ┌───┐ ┌───┐ │  ← Grille 3 colonnes
│ │ ① │ │   │ │ ② │ │     plein écran
│ └───┘ └───┘ └───┘ │
│ ┌───┐ ┌───┐ ┌───┐ │
│ │   │ │   │ │   │ │
│ └───┘ └───┘ └───┘ │
└─────────────────────────────────────────┘
```

## Section 1 : Header

### Layout
- **Gauche** : Nom de l'album actuel + icône flèche ▼
  - Tap = dropdown sheet des albums (utiliser `AlbumPickerList` existant)
- **Centre** : Deux icônes côte à côte
  - Caméra (`camera-outline`) → `onModeChange('camera')`
  - Texte (`text`) → `onPickText()`
- **Droite** : Icône overlapping squares (`copy-outline`)
  - Toggle multi-sélection (mode `single` ↔ `multi`)

### Style
- Fond : `createColors.canvas` (#000000)
- Texte : `createColors.textPrimary` (#ffffff)
- Icônes : `createColors.textPrimary`
- Toggle actif : fond `createColors.surfaceDim`, bordure blanche
- Hauteur : 44px (standard iOS header)

### Props du header
Le header est rendu dans `SelectScreen`, pas dans `GalleryGrid`.

## Section 2 : Grille plein écran

### Layout
- 3 colonnes, gap 2px, pas de padding
- FlatList scrollable qui occupe tout l'espace restant
- Plus d'aperçu ni carrousel au-dessus

### Modes de sélection

| État | Comportement |
|------|-------------|
| **Single** (défaut) | Tap cellule → `onSelectAsset(asset, false)` → navigation vers edit |
| **Multi → activation** | Tap cellule → activation mode multi + première sélection |
| **Multi → toggle** | Tap cellule → sélectionner/désélectionner (max 4) |

### Badges de sélection (mode multi)
- Badge rond `createColors.accent` (vert) en haut à droite
- Numéro de sélection (1, 2, 3, 4) en blanc, `fontWeight: '700'`
- Overlay sombre (`rgba(0,0,0,0.35)`) sur les cellules sélectionnées

### Badges vidéo
- Durée en bas à droite (`m:ss`)
- Fond semi-transparent noir

## Section 3 : Modifications SelectScreen

### État ajouté
```typescript
selectionMode: 'single' | 'multi'
```

### Props GalleryGrid modifiées
```typescript
interface GalleryGridProps {
  selectedUris: string[]
  selectionMode: 'single' | 'multi'
  onToggle: (asset: GalleryAsset) => void
  onSelectImmediate?: (asset: GalleryAsset) => void  // mode single
  selectionOrder?: Map<string, number>
}
```

### Logique de sélection
- **Mode single** : `onSelectImmediate` est appelé → le parent navigue vers edit
- **Mode multi** : `onToggle` est appelé → toggle sélection sans navigation
- Le toggle dans le header passe de `single` → `multi`
- Pas de retour automatique `multi` → `single` (l'utilisateur gère)

### Album picker
- Déplacé du rendu `GalleryGrid` vers le header `SelectScreen`
- `AlbumPickerList` reste rendu dans `GalleryGrid` (positionné en overlay)
- Le nom de l'album s'affiche dans le header

## Section 4 : Modifications GalleryGrid

### Props ajoutées
- `selectionMode: 'single' | 'multi'`
- `onSelectImmediate?: (asset: GalleryAsset) => void`

### Comportement par mode
- **Single** :
  - Pas d'overlay sombre sur les cellules
  - Pas de badge de sélection
  - Tap = appeler `onSelectImmediate(asset)`
- **Multi** :
  - Overlay sombre + badge numéroté (comportement actuel)
  - Tap = appeler `onToggle(asset)`

### Suppression
- `AlbumPickerButton` n'est plus rendu dans `GalleryGrid` (déplacé vers le header)
- `AlbumPickerList` reste (positionné en overlay)

## Section 5 : Props et état du flow

### Props SelectScreen (inchangées)
```typescript
interface SelectScreenProps {
  media: SelectedMedia[]
  mode: 'gallery' | 'camera'
  onModeChange: (mode: 'gallery' | 'camera') => void
  onSelectAsset: (asset: GalleryAsset, multiple: boolean) => void
  onCapture: (media: SelectedMedia) => void
  onPickText: () => void
}
```

### État ajouté
```typescript
const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>('single')
```

### Logique de navigation (app/create.tsx)
- Mode single : `onSelectAsset(asset, false)` → le parent gère la navigation
- Mode multi : `onSelectAsset(asset, true)` → le parent ajoute au tableau
- Le bouton "Suivant" dans l'header du create.tsx gère le passage à l'étape edit

## Section 6 : Composants impactés

| Fichier | Modification |
|---------|-------------|
| `SelectScreen.tsx` | Refactor header, ajout selectionMode, suppression preview/carrousel |
| `GalleryGrid.tsx` | Ajout selectionMode, onSelectImmediate, suppression AlbumPickerButton |
| `app/create.tsx` | Adaptation de handleRightPress pour le mode single/multi |

## Section 7 : Cas spéciaux

- **Vidéo seule** : toujours en mode single (pas de carrousel mixte)
- **Permission refusée** : inchangé (gate existant)
- **Album vide** : inchangé (message existant)
- **Pagination** : inchangée (FlatList onEndReached)

## Section 8 : Tests

- Test unitaire : vérifier que le mode single appelle `onSelectImmediate`
- Test unitaire : vérifier que le mode multi appelle `onToggle`
- Test visuel : badges numérotés affichés correctement
- Test visuel : header rendu avec album picker + icônes
