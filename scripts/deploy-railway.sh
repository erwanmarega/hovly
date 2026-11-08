#!/bin/sh
# Déploie une image Docker précise sur un service Railway, puis attend le résultat.
#
#   1. serviceInstanceUpdate  : le service pointe sur l'image du commit (web:<sha>)
#   2. serviceInstanceDeployV2: lance le déploiement (serviceInstanceRedeploy, lui,
#                               rejouerait l'ancienne image)
#   3. deployment(id)         : attend SUCCESS, échoue sur FAILED / CRASHED
#   4. smoke test HTTP sur l'URL publique
#
# Variables attendues :
#   RAILWAY_TOKEN           token de projet (Project Settings → Tokens), variable CI masquée
#   RAILWAY_ENVIRONMENT_ID  RAILWAY_SERVICE_ID
#   DEPLOY_IMAGE            ex. registry.gitlab.com/erwanmarega/hovly/web:abc1234
#   DEPLOY_URL              URL publique à vérifier après le déploiement (optionnel)
#   DEPLOY_TIMEOUT          secondes d'attente max (optionnel, 600 par défaut)
set -eu

: "${RAILWAY_TOKEN:?RAILWAY_TOKEN manquant (Settings → CI/CD → Variables)}"
: "${RAILWAY_ENVIRONMENT_ID:?}"
: "${RAILWAY_SERVICE_ID:?}"
: "${DEPLOY_IMAGE:?}"
TIMEOUT="${DEPLOY_TIMEOUT:-600}"
API="https://backboard.railway.com/graphql/v2"

# Appelle l'API GraphQL. $1 = requête, $2 = variables JSON. Échoue sur toute erreur GraphQL.
gql() {
  payload=$(jq -n --arg q "$1" --argjson v "$2" '{query: $q, variables: $v}')
  response=$(curl -sS --fail-with-body "$API" \
    -H "Content-Type: application/json" \
    -H "Project-Access-Token: $RAILWAY_TOKEN" \
    -d "$payload") || { echo "Erreur HTTP de l'API Railway : $response" >&2; exit 1; }
  if [ "$(echo "$response" | jq '.errors // [] | length')" != "0" ]; then
    echo "Erreur GraphQL : $(echo "$response" | jq -c '.errors')" >&2
    exit 1
  fi
  echo "$response"
}

ids=$(jq -n --arg s "$RAILWAY_SERVICE_ID" --arg e "$RAILWAY_ENVIRONMENT_ID" \
  '{serviceId: $s, environmentId: $e}')

echo "→ Source du service : $DEPLOY_IMAGE"
gql 'mutation ($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
  serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
}' "$(echo "$ids" | jq --arg img "$DEPLOY_IMAGE" '. + {input: {source: {image: $img}}}')" > /dev/null

echo "→ Lancement du déploiement"
deployment_id=$(gql 'mutation ($serviceId: String!, $environmentId: String!) {
  serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
}' "$ids" | jq -r '.data.serviceInstanceDeployV2')
echo "  déploiement $deployment_id"

echo "→ Attente du résultat (max ${TIMEOUT}s)"
elapsed=0
while :; do
  status=$(gql 'query ($id: String!) { deployment(id: $id) { status } }' \
    "$(jq -n --arg id "$deployment_id" '{id: $id}')" | jq -r '.data.deployment.status')
  echo "  [${elapsed}s] $status"
  case "$status" in
    SUCCESS) break ;;
    FAILED | CRASHED | REMOVED | SKIPPED)
      echo "Le déploiement a échoué ($status) : voir les Deploy logs du service sur Railway." >&2
      exit 1 ;;
  esac
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "Délai dépassé : le déploiement est toujours $status." >&2
    exit 1
  fi
  sleep 10
  elapsed=$((elapsed + 10))
done

if [ -n "${DEPLOY_URL:-}" ]; then
  echo "→ Smoke test : $DEPLOY_URL"
  curl -sS --fail --retry 5 --retry-delay 5 --retry-all-errors -o /dev/null "$DEPLOY_URL"
  echo "  OK"
fi

echo "✔ $DEPLOY_IMAGE est en production"
