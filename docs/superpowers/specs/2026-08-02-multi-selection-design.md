# Sélection multiple et aperçu carrousel dans le flux de création

*2026-08-02*

## Le problème

Le flux de création impose « une photo ou une vidéo ». Or le modèle de données supporte déjà les carrousels (`format: 'carousel'`, `NewsPost.media: NewsPostMedia[]`), l'upload boucle sur `draft.media`, et le rendu du feed gère les mosaïques jusqu'à 4 médias. La contrainte est artificielle et locale à trois fichiers.

Par ailleurs, l'aperçu carré de SelectScreen ne montre jamais d'état de chargement — l'image apparaît sans transition.

## Ce qu'on construit

### 1. OrbitLoader dans l'aperçu SelectScreen

Dès qu'au moins un média est sélectionné, l'aperçu affiche le premier média via expo-image. OrbitLoader se superpose le temps du `transition` de l'image (100 à 200 ms en conditions réelles, plus long sur simulateur).

**Mise en œuvre** : expo-image expose `onLoadStart` / `onLoadEnd`. Un état local `loading` dans le composant aperçu, et `<OrbitLoader size={40} />` centré en absolu par-dessus l'image.

Pas de changement dans CaptionScreen : l'aperçu là-bas charge depuis le même cache.

### 2. Sélection multiple

**Cap** : 4 médias maximum. Cohérent avec le rendu mosaïque du feed (optimisé pour 4) et l'ancien composeur (`COMPOSE_MAX_MEDIA`).

**Interaction dans la grille** :

- Tap sur une vignette non sélectionnée → ajout (si < 4 médias)
- Tap sur une vignette sélectionnée → retrait
- Badge numéroté sur chaque vignette sélectionnée (1, 2, 3, 4) — ordre d'ajout, pas position dans la grille

**Données** :

- `SelectScreen` reçoit `media: SelectedMedia[]` au lieu de `selected: SelectedMedia | null`
- `create.tsx:handleToggle` bascule en add/remove avec cap
- `GalleryGrid` reçoit toujours `selectedUris: string[]` — il ne connaît pas le cap, il coche les URIs qu'on lui donne

**Mix photo/vidéo** : autorisé. Le carrousel affiche les deux types ensemble. Le format du post passe à `'carousel'` dès que `media.length > 1`, quel que soit le mix. Le chemin vidéo seul (`isVideoOnly`) reste pour une sélection vidéo unique.

### 3. Aperçu en carrousel horizontal

Une bande de vignettes carrées sous l'aperçu principal, scrollable horizontalement. La vignette du média affiché en grand porte une bordure accent. Un tap sur une vignette du carrousel la met en grand dans l'aperçu.

**Taille des vignettes** : 56 px de côté, 4 px de gap, coins 4 px. Le carrousel est centré horizontalement, défile si plus de 3 médias.

**Visibilité** : le carrousel n'apparaît que si au moins un média est sélectionné. Disparaît avec l'aperçu quand on scrolle (il fait partie du header de la FlatList).

### 4. Navigation

Le bouton « Suivant » n'apparaît que si au moins un média est sélectionné. CaptionScreen reçoit `media: SelectedMedia[]` et affiche le même carrousel.

## Fichiers impactés

| Fichier | Changement |
|---------|------------|
| `app/create.tsx` | `handleToggle` en add/remove, `media: SelectedMedia[]`, navigation conditionnelle |
| `src/features/create/components/SelectScreen.tsx` | Prop `media: SelectedMedia[]`, carrousel aperçu, OrbitLoader |
| `src/features/create/components/GalleryGrid.tsx` | Badge numéroté dans GridCell |
| `src/features/create/components/CaptionScreen.tsx` | Prop `media: SelectedMedia[]`, carrousel aperçu |

## Vérification

Manuelle sur simulateur par l'utilisateur :

1. OrbitLoader apparaît pendant le chargement de l'aperçu
2. On peut sélectionner jusqu'à 4 médias, badges numérotés visibles
3. Le 5e tap n'ajoute pas, le tap sur sélectionné retire
4. Le carrounel horizontal reflète la sélection
5. Le mix photo/vidéo est autorisé

Automatisable : `npx tsc --noEmit` reste à 3 erreurs préexistantes, `npx expo export --platform ios` passe.
