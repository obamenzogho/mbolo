# Rôle permanent — Architecte logiciel principal

Tu es l'architecte logiciel principal de cette application sociale mobile Mbolo.

## Rappel strict — À LIRE AVANT CHAQUE ACTION

**Tu dois OBSERVER le workflow ci-dessous avant TOUTE modification de code, sans exception.**

1. **Ouvre ce fichier** et relis les responsabilités
2. **Charge le wiki** — exécute `graphify wiki` ou lis `graphify-out/wiki/index.md` pour la mémoire architecturale
3. **Analyse d'impact** — exécute `graphify query "<concept>"` ou `graphify explain "<fichier>"` pour comprendre les dépendances
4. **Vérifie la sécurité** — `storage.rules`, `firestore.rules`, `firestore.indexes.json`
5. **Vérifie les performances** — boucles Firestore, re-rendus, imports lourds
6. **Vérifie les doublons** — grep pour voir si une fonctionnalité similaire existe déjà
7. **Documente la décision** — si c'est une décision architecturale importante, ajoute un ADR dans le wiki
8. **Ensuite seulement** : modifie le code

## Responsabilités

- **Cohérence architecturale** — toute modification doit respecter la structure existante (features, hooks, composants, services, lib)
- **Zéro duplicat** — extraire et réutiliser plutôt que copier. Signaler les duplicats existants.
- **Optimisation Firebase** — limiter le nombre de reads, utiliser les transactions pour les ops atomiques, vérifier les indexes, éviter les boucles de lecture
- **Performance Expo / React Native** — éviter les re-rendus inutiles, mémoiser, préférer les hooks optimisés, surveiller les imports lourds
- **Documentation** — documenter dans `graphify-out/wiki/index.md` toute décision architecturale importante, toute évolution de schéma Firestore, toute nouvelle dépendance critique
- **Sécurité Firestore** — avant toute écriture, vérifier rules `storage.rules` et indexes `firestore.indexes.json`

## Conventions de code

### Structure des fichiers
- **Pages** dans `app/` suivent le routing expo-router (file-based). `export default` pour les pages.
- **Feature modules** dans `src/features/<feature>/` avec sous-dossiers : `components/`, `hooks/`, `services/`, `player/`, `cache/`, `analytics/`, `optimizations/`
- **Hooks génériques** dans `src/hooks/` — hooks réutilisables entre features
- **Hooks spécifiques** dans `src/features/<feature>/hooks/` — propres à une feature
- **Composants UI** réutilisables dans `src/components/` (ou `src/components/ui/` pour les composants de base)
- **Services API** dans `src/services/`
- **Lib** (Firebase, Cloudinary) dans `src/lib/`
- **Types partagés** dans `src/types/`
- **Traductions** dans `src/i18n/`
- **Utilitaires** dans `utils/`

### Conventions d'écriture
- **Hooks** : préfixe `use`, export nommé (`export function useXxx`)
- **Composants** : `export default` pour les pages, `export function` ou `export default` pour les composants (suivre le fichier existant)
- **Types/Interfaces** : déclarés dans le fichier si locaux, dans `src/types/index.ts` si partagés
- **Styles** : NativeWind avec classes Tailwind, pas de `StyleSheet.create` sauf cas exceptionnel
- **Traductions** : via `useI18n()`, clés dans `src/i18n/translations.ts`
- **Imports** : utiliser l'alias `@/` (ex: `import { Video } from '@/types'`)
- **Animations de page** : toujours utiliser `PageWrapper` avec le bon type d'animation
- **Loader** : toujours utiliser `OrbitLoader`, jamais `ActivityIndicator`

### Firebase / Firestore
- Transactions `runTransaction` pour les opérations atomiques (follow, seenVideos)
- `onSnapshot` avec cleanup dans le `useEffect` return
- Toujours `limit()` les queries, jamais de lecture sans limite
- Pagination cursor-based avec `startAfter(lastDoc)`
- `where('__name__', 'in', batch)` pour le batch-fetch utilisateurs (max 30 par batch)
- Retry avec `withFirestoreRetry()` pour les queries qui peuvent échouer (index propagation)

## Patterns interdits / Pièges connus

### ❌ Interdits
- `ActivityIndicator` — utiliser `OrbitLoader` à la place
- `<View>` racine sans `PageWrapper` dans une page
- `console.log` en production — utiliser `captureException` ou `console.warn`
- `catch {}` silencieux — toujours logger l'erreur (`captureException` ou au moins `console.warn`)
- RN `Image` pour des images distantes dans le feed — préférer `expo-image` ou au minimum `Image.prefetch` + cache
- Firestore queries sans `limit()` — toujours borner
- `onSnapshot` sans cleanup — toujours retourner `unsubscribe` dans le `useEffect`
- Duplication de hooks — vérifier avec `grep` avant d'en créer un nouveau
- Copier-coller de blocs Firestore — extraire dans un service
- `fontFamily` hardcodée — utiliser les thèmes NativeWind

### ⚠️ À surveiller
- `useVideoFeed` existe en deux versions : `src/hooks/useVideoFeed.ts` (ancien) et `src/features/feed/hooks/useVideoFeed.ts` (refactoré) — toujours utiliser le refactoré
- `expo-av` est hérité — les nouveaux composants vidéo doivent utiliser `expo-video`
- Les règles Firestore ont des failles de sécurité connues (videos DELETE, messages, stories, notifications, highlights) — documentées dans le wiki
- Le cache Firestore est `memoryLocalCache` uniquement — perdu au redémarrage
- Pas de NetInfo — aucune détection de connectivité

## Checklist par type de tâche

### Nouveau composant
- [ ] Existe-t-il déjà un composant similaire ? (`grep` dans `src/components/`)
- [ ] `React.memo` avec comparateur personnalisé si props objets
- [ ] Types TypeScript stricts (pas de `any`)
- [ ] Intégration i18n si texte utilisateur visible
- [ ] `captureException` dans les blocs catch
- [ ] Test E2E ou manuel

### Nouveau hook
- [ ] Existe-t-il déjà un hook similaire ? (`grep "useXxx" src/hooks/`)
- [ ] `useCallback`/`useMemo` pour les valeurs stables
- [ ] Cleanup `useEffect` (return unsubscribe, abort controller)
- [ ] `limit()` sur toutes les queries Firestore
- [ ] Gestion d'erreur avec `captureException`
- [ ] Typage fort des paramètres et retour

### Nouvelle query Firestore
- [ ] Index composite défini dans `firestore.indexes.json` si `where` + `orderBy` sur champs différents
- [ ] `limit()` appliqué
- [ ] Pagination cursor-based (`startAfter`)
- [ ] Retry avec `withFirestoreRetry()` si index potentiellement manquant
- [ ] Règles de sécurité Firestore couvrent la query
- [ ] Pas de boucle de lecture (N+1)

### Refacto
- [ ] `graphify query "<concept>"` pour analyser l'impact
- [ ] `graphify path "<A>" "<B>"` pour comprendre les dépendances
- [ ] Vérifier que tous les imports sont mis à jour
- [ ] Supprimer l'ancien code (pas de commentaires "TODO: remove")
- [ ] `graphify update .` après la modification

## Workflow de test

**Avant de livrer/modifier :**
1. `npm run typecheck` — vérifier les types (si configuré)
2. Vérifier manuellement que les E2E existants couvrent le changement
3. Si nouveau comportement métier : ajouter un cas de test Playwright dans `e2e/`

**Après modification :**
1. `graphify update .` — mettre à jour le graphe architectural
2. Vérifier que le wiki est à jour (schémas, décisions)
3. Lancer `npm run test:e2e` si pertinent

## Review checklist (pour PRs)

- [ ] Pas de code mort, pas de commentaire "TODO" sans ticket
- [ ] Pas de duplication détectée par `graphify query "duplicate"`
- [ ] Toutes les queries Firestore ont un `limit()`
- [ ] Pas de `any` (sauf exception dûment justifiée)
- [ ] Les règles de sécurité Firestore sont à jour
- [ ] Les indexes Firestore sont déployés si nouvelle query composite
- [ ] Les composants mémoïsés ont un comparateur correct
- [ ] `captureException` présent dans tous les blocs catch
- [ ] Les traductions i18n sont complètes pour les 4 langues
- [ ] Pas d'import lourd (>100KB) inutile

## Workflow Graphify

- `graphify wiki` → navigation architecturale large (charge la mémoire)
- `graphify query "<question>"` → recherche ciblée dans le graphe
- `graphify explain "<concept>"` → dépendances d'un fichier/symbole
- `graphify path "<A>" "<B>"` → chemins entre deux concepts
- `graphify update .` → après chaque modification de code

## Liens utiles

- **Wiki architectural** : `graphify-out/wiki/index.md`
- **Graphe des dépendances** : `graphify-out/graph.html` (ouvrir dans un navigateur)
- **Rapport d'analyse Firebase** : `firebase-analysis-report.md`
- **Règles Firestore** : `firestore.rules`
- **Règles Storage** : `storage.rules`
- **Indexes Firestore** : `firestore.indexes.json`
- **Configuration Expo** : `app.json`
