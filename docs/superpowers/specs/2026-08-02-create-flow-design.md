# Design — Nouveau flux de création unifié (post / vidéo)

**Date** : 2026-08-02 · **Statut** : approuvé · **Remplace** : `news-compose` et `video-editor`

## Problème

Mbolo a deux flux de création disjoints : `news-compose` → collection `posts` (fil d'actus) et `video-editor` (legacy) → collection `videos` (feed vidéo). Un prototype web façon Instagram Reels a été conçu (`createPost-instagram/`) : flux **Select → Edit/Text → Caption → Publish** avec édition photo (filtres, ajustements, overlays), édition vidéo (trim, vitesse, musique, sous-titres), posts texte (palettes) et multi-clips.

**Objectif** : remplacer les deux flux par un **flux de création unique** porté en natif, avec **rendu réel** (le feed ne rejoue rien) et un modèle **sound-first**.

## Décisions actées

1. **Périmètre v1** : photo + texte + vidéo simple (trim, vitesse, filtre, musique). Multi-clips et sous-titres différés.
2. **Données** : un seul écran, mais écrit dans `posts` (photo/texte) et `videos` (vidéo). Les deux feeds restent en l'état.
3. **Musique sound-first** : collection `sounds` + référence `soundId` (déjà présent dans `NewsPost`, `Video`, index Typesense).
4. **Le nouveau flux remplace tout** à la création (sondage, article, fonds abandonnés ; le rendu des anciens posts reste).
5. **Rendu réel** : photos filtrées au rendu, vidéos montées via `ffmpeg-kit-react-native`.

## Architecture

- Route `/create` (remplace `/news-compose`, `/video-editor`). `openCreateModal` (`CreateModalContext`) y mène.
- Module `src/features/create/` : `CreateFlow` + écrans (`SelectScreen`, `EditScreen`, `TextCreate`, `CaptionScreen`, `VideoEditor`, `MusicPicker`) + services (rendu photo/vidéo, sons) + `theme/createTokens.ts` + i18n `create.*`.
- Réutilise : `useGallery`/`GalleryGrid`, `ComposeCamera`, `VisibilitySheet`, `PublishProgress`, `uploadToCloudinary`, `expo-video-thumbnails`, `ffmpeg-kit-react-native`, `react-native-svg`.

## Modèle de données (sound-first)

```
sounds/{id}   { id, title, artist, mood, bpm, duration, audioURL, coverURL, source: 'library'|'user' }
posts/{id}    NewsPost + edit?: PostEdit{ filterId, filterIntensity, adjustments, overlay, aspect, rotation }
              + paletteId?/fontId?/align? (texte) + soundId?
videos/{id}   modèle existant (videoURL = fichier rendu, thumbnailURL, description, hashtags, soundId, ...)
```

- `Adjustments { brightness, contrast, saturation, warmth, fade, highlights, shadows, tint, sharpen, vignette }`
- `OverlayEl = stroke | text | sticker`
- `Sound` remplace `Track` du prototype.

## Pipeline de rendu

- **Photo** : `applyPhotoEdit(source, edit)` via ffmpeg-kit (`eq`, `colorbalance`, `hue`, `vignette`) → upload Cloudinary. Image stockée = résultat fini.
- **Vidéo** : `renderVideo(source, { trim, speed, filter, music })` via ffmpeg-kit (dont `amix` pour la musique) → mp4 fini → upload `video/upload` → thumbnail → doc `videos`.
- Erreurs distinguées (render / upload / write), cooldown anti-spam, contexts Sentry namespacés.

## Sécurité

- **Rate limit vidéo** : garde-fou serveur symétrique à `onPostCreateRateLimit` (pattern `functions/src/posts/onPostCreate.ts`) sur la création `videos`.
- **Collection `sounds`** : règles Firestore — lecture publique, écriture restreinte.

## Suppressions

- `app/news-compose.tsx`, `src/features/news/components/compose/`, `src/features/news/hooks/useCompose*`, `app/(tabs)/(sub)/video-editor.tsx`.
- Le rendu des anciens contenus (PostCard/PostBody, article, sondage) reste intact.

## Phasage

- **P1 — Socle** : route `/create`, Select (galerie+caméra+texte), Caption, publication brute `posts`/`videos`, suppression des anciens écrans, rate-limit vidéo + règles `sounds`.
- **P2 — Édition photo** : `EditScreen` (filtre/ajustements/texte/sticker) + `applyPhotoEdit`.
- **P3 — Vidéo simple** : `VideoEditor` (trim/vitesse/filtre) + `renderVideo` ffmpeg.
- **P4 — Musique** : collection `sounds` + `MusicPicker` + mix dans `renderVideo`.

## Vérification

- `npx tsc --noEmit` : 0 nouvelle erreur. `npm run build` (functions) : OK.
- Manuel (émulateur) : `/create` depuis header feed + profil → galerie/caméra/texte/vidéo → éditer → publier → contenu visible dans `posts`/`videos` avec rendu final.
- Anciens contenus toujours lisibles. Rate-limit vidéo fonctionnel.
