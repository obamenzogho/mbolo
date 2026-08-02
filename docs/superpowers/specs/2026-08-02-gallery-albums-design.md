# Pellicule : plus de place, et accès aux albums

*2026-08-02*

## Le problème

Dans l'écran de création (`SelectScreen`), la pellicule ne dispose que de
131 px de haut : l'aperçu carré de 330 px mange l'écran. On voit une ligne et
demie de vignettes. Et la grille ne lit que la pellicule principale — aucun
moyen d'atteindre un autre album.

Deux besoins, donc : voir plus de photos, et changer de dossier.

## Ce qu'on construit

### 1. L'aperçu défile avec la grille

`GalleryGrid` accepte un `ListHeaderComponent`. `SelectScreen` lui passe son
aperçu et sa barre « Créer » au lieu de les rendre au-dessus. Tout défile
ensemble : l'aperçu quitte l'écran, la grille occupe toute la hauteur.

`SelectScreen` garde la maîtrise de sa mise en page — il fabrique le nœud
d'en-tête, `GalleryGrid` ne fait que le placer.

Pas d'animation, pas de worklet. L'aperçu disparaît franchement au lieu de
rétrécir progressivement. Une version Reanimated (en-tête en position
absolue, `scrollY` partagé, calcul de marge) donnerait le rétrécissement
continu d'Instagram, au prix de beaucoup plus de pièces mobiles. On s'en
passe.

Conséquence assumée : avec 330 px d'aperçu, il part vite.

### 2. Le sélecteur d'albums

**Placement.** Le déclencheur — le nom de l'album courant suivi d'un chevron,
« Toutes les photos ▾ » au démarrage — se loge dans l'en-tête
scrollable, tout en bas : aperçu → barre Créer → bouton album → grille. Il
part avec l'aperçu quand on défile ; il faut remonter d'un geste pour changer
d'album. Une barre épinglée mettrait le sélecteur *au-dessus* de l'aperçu, ce
qui se lit mal, et `stickyHeaderIndices` cohabite mal avec `numColumns`.

**Découpage.** Nouveau fichier `AlbumPicker.tsx`, purement présentationnel :
il reçoit `albums`, `currentId`, `onSelect`, et rend le bouton plus la liste
déroulante. `GalleryGrid` garde la donnée et le chargement. `GalleryGrid`
fait déjà 314 lignes ; y ajouter le chargement des albums *et* l'interface du
menu le pousserait vers 450.

**La liste déroulante** est une `View` en `position: absolute` par-dessus la
racine de `GalleryGrid` — fond assombri, `FlatList` d'albums. Pas un `Modal` :
elle vit dans l'arbre de la grille, donc ni portail ni conflit de
superposition avec la barre d'onglets.

**Données.** On duplique une quinzaine de lignes plutôt que réutiliser
`useGallery`. Ce hook traîne sa propre machine à états d'assets — avec le bug
de dépendance `[permission]` qui rechargeait en boucle — et son
`getAssetInfoAsync` par vignette, qu'on a précisément écarté pour la
surchauffe. Dans `GalleryGrid` :

- `MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true })`, chargé une fois
  quand `granted` passe à vrai, sous la même garde que `loadAssets`
- filtrage : `assetCount > 0`, et on écarte les albums système sans intérêt
  (masqués, récemment supprimés)
- une entrée synthétique en tête, `id: null`, « Toutes les photos » — c'est le
  comportement actuel (pas de `options.album`), donc le défaut ne bouge pas

**Changement d'album.** `albumId` devient un état ; `loadAssets` le lit et
pose `options.album = albumId` quand il n'est pas nul — il entre donc dans les
dépendances du `useCallback`, ce qui suffit à déclencher le rechargement. À la
sélection : `cursorRef.current = null`, `hasMoreRef.current = true`, et
`setAssets([])` — laisser les photos de l'ancien album sous le nom du nouveau
serait faux le temps du chargement.

Une remise à zéro passe outre le verrou `loadingRef`, sans quoi changer
d'album pendant qu'une page charge laisserait la grille sur l'album
précédent. Un compteur de requête rend la réponse périmée sans effet.

**i18n.** Deux clés dans les 4 locales, à côté des `gallery*` existantes :
`galleryAlbumAll` (« Toutes les photos ») et `galleryAlbums` (titre du menu).
Les titres d'albums viennent du système, non traduits.

**Erreurs.** Un échec de `getAlbumsAsync` ne casse pas la pellicule : la liste
reste vide, le bouton disparaît, la grille continue d'afficher toutes les
photos.

## Vérification

Pas de tests automatisés ici. Le projet n'a pas de harnais de rendu React
Native, et le bug d'origine — cellule à largeur nulle, causée par NativeWind
qui n'appelait pas la forme fonction de `style` sur `Pressable` — ne se serait
attrapé qu'en rendu réel. Un test unitaire l'aurait laissé passer.

Vérification manuelle sur simulateur, par l'utilisateur :

1. La grille remplit l'écran quand on défile, l'aperçu sort du champ
2. La pagination continue au-delà de 60 en fin de liste
3. Le bouton album ouvre le menu ; la sélection recharge la grille depuis zéro
4. « Toutes les photos » ramène l'état initial
5. Un album vide n'apparaît pas dans la liste

Automatisable : `npx tsc --noEmit` reste à 3 erreurs (préexistantes, dans
`PostResultCard.tsx` et `hashtagService.ts`), et `npx expo export --platform
ios` passe.

## Hors périmètre

- Le rétrécissement animé de l'aperçu
- La sélection multiple (la règle « une photo ou une vidéo » ne change pas)
- Le nettoyage du bug `[permission]` dans `useGallery.ts` — réel, mais dans un
  hook que cet écran n'utilise pas
