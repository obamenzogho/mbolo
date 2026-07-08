# Statut de déploiement — verrouillage serveur des compteurs + hotScore

Dernière MAJ : 2026-07-08

## État live vs en attente

| Élément | État | Note |
|---|---|---|
| Code (`main`) | ✅ Poussé (`8d7d42f..326246c`) | commit `326246c` |
| Indexes Firestore | ✅ Déployé (`mbolo-51177`) | composite `hotScore` + `createdAt` |
| `firestore.rules` (nouvelles) | ⏸️ Compilées OK, **non déployées** | les règles live sont encore les ANCIENNES |
| Cloud Functions | ❌ Bloqué | voir « Bloqueur Blaze » |
| Client (nouveau) | ⏸️ En `main`, non publié | ne pas publier avant functions live |

## 🚨 Bloqueur : plan Blaze obligatoire

Le déploiement des Cloud Functions échoue avec :
> `Your project mbolo-51177 must be on the Blaze (pay-as-you-go) plan`

Les Cloud Functions (2e gen, `firebase-functions/v2`) ne déploient pas sur le plan
Spark gratuit. Tout le verrou serveur (compteurs + hotScore) en dépend.

- Upgrade : https://console.firebase.google.com/project/mbolo-51177/usage/details
- Free tier généreux (≈ 2 M invocations/mois offertes) → risque de coût minime.

## ⚠️ Danger : ne pas déployer règles + client sans les functions

Si les nouvelles règles `owner-only` (verrou) sont déployées SANS les functions :
- le client ne écrit plus les compteurs (retirés volontairement) ;
- les functions ne tournent pas (pas de Blaze) ;
- ⇒ **likes / saves / reposts / comments ne s'incrémentent plus** (UI optimiste
  remonte, puis le snapshot écrase à l'ancienne valeur). Régression silencieuse.

Les règles live sont encore les anciennes → c'est plus sûr pour l'instant.
**Ne bascule pas tant que functions ≠ live.**

## Ordre de déploiement (dès Blaze actif)

1. **Upgrade Blaze** (prérequis functions).
2. **Functions** : `cd functions && npm run build && npm run deploy`
3. **Seed hotScore** (marche sans Blaze, admin SDK local) :
   `GOOGLE_APPLICATION_CREDENTIALS=… node scripts/seedHotScores.mjs`
   → obligatoire avant le client, sinon le feed « Pour Toi » est vide
   (vidéos sans `hotScore` exclues du `orderBy('hotScore')`).
4. **Règles** (depuis la racine, PAS depuis `functions/`) :
   `cd ~/Desktop/mbolo && npm run firebase:deploy:rules`
5. **Client** en dernier.

## ⚠️ CI

`git push` de `main` est fait. Si une pipeline auto-build/publie le client depuis
`main`, **la suspendre** jusqu'à ce que les functions soient live (sinon le
nouveau client part en prod et casse les compteurs).

## Scripts firebase-admin (à lancer en local, hors Blaze)

- `scripts/seedHotScores.mjs` — calcule `hotScore` sur TOUTE la collection
  (vidéos > 14 j non couvertes par le planifié). `DRY_RUN=1` pour tester.
- `scripts/backfillCounters.mjs` — recalcule les compteurs vidéo depuis les
  sous-collections (utile si double-comptage passé). `DRY_RUN=1` pour tester.

## À corriger à part (préexistant, hors verrou)

Erreurs `tsc --noEmit` non introduites par ce chantier, à traiter séparément :
- `*.test.ts` : types jest absents du `tsc` brut.
- `shareService.ts` : `Timestamp` « non exporté » + paramètres `any` implicites
  (`getSharesForVideo`, `searchUsers`).
- `repostService.ts` : `captureException(result.error…)` dans `getRepostedVideos`
  (`result.error` n'est pas un `Error`).
