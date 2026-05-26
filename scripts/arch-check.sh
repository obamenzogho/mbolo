#!/bin/bash
# =====================================================================
# arch-check.sh — Vérification architecturale automatique pour Mbolo
# Utilisation : bash scripts/arch-check.sh [--fix] [--verbose]
# =====================================================================

set -o pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERBOSE=false
FIX=false
EXIT_CODE=0

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
WARN=0
FAIL=0

function info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
function ok()    { echo -e "${GREEN}[PASS]${NC}  $1"; ((PASS++)); }
function warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; ((WARN++)); }
function fail()  { echo -e "${RED}[FAIL]${NC}  $1"; ((FAIL++)); EXIT_CODE=1; }

function section() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${BLUE}  $1${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=true ;;
    --fix)     FIX=true ;;
    --help)
      echo "Usage: bash scripts/arch-check.sh [--fix] [--verbose]"
      echo ""
      echo "  --fix       Tente de corriger automatiquement les problèmes détectés"
      echo "  --verbose   Affiche les détails de chaque vérification"
      echo "  --help      Affiche cette aide"
      exit 0
      ;;
  esac
done

cd "$ROOT_DIR" || exit 1

# =====================================================================
# 1. Graphify — mise à jour du graphe
# =====================================================================
section "1/8 — Analyse du graphe architectural (graphify)"

if command -v node &>/dev/null; then
  info "Mise à jour du graphe..."
  node scripts/graphify-cli.js update . 2>&1 | tail -1
  GRAPH_NODES=$(node -e "
    const g = JSON.parse(require('fs').readFileSync('graphify-out/graph.json','utf8'));
    console.log(g.nodes.length, g.links.length);
  " 2>/dev/null || echo "0 0")
  NODES=$(echo "$GRAPH_NODES" | cut -d' ' -f1)
  EDGES=$(echo "$GRAPH_NODES" | cut -d' ' -f2)

  if [ "$NODES" -gt 0 ] 2>/dev/null; then
    ok "Graphe mis à jour : $NODES nœuds, $EDGES arêtes"
  else
    fail "graphify update a échoué ou n'a produit aucun nœud"
  fi
else
  fail "Node.js requis pour graphify"
fi

# =====================================================================
# 2. Queries Firestore sans limit()
# =====================================================================
section "2/8 — Queries Firestore sans limit()"

RESULTS=$(grep -rn "collection\|getDocs\|onSnapshot" src/ app/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "limit(" \
  | grep -v "getDoc(doc\|doc(\|collection(\|//\|\.test\|\.spec\|node_modules" \
  | grep -E "(getDocs|onSnapshot)" \
  | head -20)

if [ -z "$RESULTS" ]; then
  ok "Toutes les queries Firestore ont un limit()"
else
  warn "Queries sans limit() détectées (affiche les 20 premières) :"
  echo "$RESULTS" | while read -r line; do
    echo "       $line"
  done
  echo "       → Utilise 'limit()' sur toutes les lectures Firestore"
fi

# =====================================================================
# 3. Vérification des index composites
# =====================================================================
section "3/8 — Index composites Firestore"

if [ -f "firestore.indexes.json" ]; then
  INDEX_COUNT=$(node -e "
    const idx = JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8'));
    console.log(idx.indexes ? idx.indexes.length : 0);
  ")
  ok "$INDEX_COUNT indexes composites définis dans firestore.indexes.json"
else
  fail "firestore.indexes.json manquant"
fi

# =====================================================================
# 4. Détection de catch {} silencieux
# =====================================================================
section "4/8 — Catch {} silencieux"

SILENT_CATCH=$(grep -rn "catch\s*(" src/ app/ \
  --include="*.ts" --include="*.tsx" \
  | grep -E "catch\s*\(\s*\)\s*\{\s*\}" \
  | grep -v "//.*ok\|//.*expected" \
  | head -10)

if [ -z "$SILENT_CATCH" ]; then
  ok "Aucun catch {} silencieux"
else
  warn "Catch silencieux détectés (devraient utiliser captureException ou console.warn) :"
  echo "$SILENT_CATCH" | while read -r line; do
    echo "       $line"
  done
fi

# =====================================================================
# 5. Vérification des duplicats de hooks
# =====================================================================
section "5/8 — Duplicats de hooks"

# Vérifier les hooks qui existent en double (même nom dans src/hooks/ et src/features/*/hooks/)
DUPLICATE_HOOKS=$(find src/hooks src/features -name "use*.ts" -o -name "use*.tsx" 2>/dev/null \
  | xargs -I{} basename {} \
  | sort \
  | uniq -c \
  | sort -rn \
  | head -5 \
  | grep -v "^[[:space:]]*1 ")

if [ -z "$DUPLICATE_HOOKS" ]; then
  ok "Aucun duplicat de hook détecté"
else
  warn "Hooks dupliqués potentiels :"
  echo "$DUPLICATE_HOOKS" | while read -r line; do
    echo "       $line"
  done
  echo "       → Vérifier avec 'graphify query <hook>'"
fi

# =====================================================================
# 6. Vérification console.log en production
# =====================================================================
section "6/8 — console.log dans le code source"

CONSOLE_LOG=$(grep -rn "console\.\s*\(log\|debug\)" src/ app/ \
  --include="*.ts" --include="*.tsx" \
  | grep -v "console\.log\|//.*dev\|//.*debug\|//.*ok\|IS_DEV_MODE\|\.spec\.\|node_modules" \
  | head -10)

if [ -z "$CONSOLE_LOG" ]; then
  ok "Aucun console.log suspect"
else
  warn "console.log présents dans le code (vérifier s'ils sont en dev seulement) :"
  echo "$CONSOLE_LOG" | while read -r line; do
    echo "       $line"
  done
fi

# =====================================================================
# 7. Vérification des règles de sécurité
# =====================================================================
section "7/8 — Règles de sécurité"

RULES_OK=true

if [ ! -f "firestore.rules" ]; then
  fail "firestore.rules manquant"
  RULES_OK=false
fi

if [ ! -f "storage.rules" ]; then
  fail "storage.rules manquant"
  RULES_OK=false
fi

if [ ! -f "firestore.indexes.json" ]; then
  fail "firestore.indexes.json manquant"
  RULES_OK=false
fi

if [ "$RULES_OK" = true ]; then
  ok "Tous les fichiers de sécurité présents (firestore.rules, storage.rules, firestore.indexes.json)"

  # Vérifier les règles Firebase connues comme vulnérables
  VULN=$(grep -c "allow delete: if request.auth.uid == resource.data.userId;" firestore.rules)
  if [ "$VULN" -eq 0 ]; then
    warn "Videos DELETE non protégé dans firestore.rules — tout utilisateur peut supprimer n'importe quelle vidéo"
  fi
fi

# =====================================================================
# 8. Résumé
# =====================================================================
section "Résumé"

TOTAL=$((PASS + WARN + FAIL))
echo -e "  ${GREEN}$PASS passed${NC}  ${YELLOW}$WARN warnings${NC}  ${RED}$FAIL failed${NC}  sur $TOTAL vérifications"

if [ "$EXIT_CODE" -eq 0 ]; then
  echo -e "\n${GREEN}✓ Tout est conforme.${NC}"
else
  echo -e "\n${RED}✗ Des problèmes ont été détectés (voir détails ci-dessus).${NC}"
fi

exit $EXIT_CODE
