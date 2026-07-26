#!/bin/sh
# Déclenche les tâches planifiées du service web.
#
# Passe par le réseau privé Railway (WEB_INTERNAL_URL =
# http://<service-web>.railway.internal:3000) et non par le domaine public : le
# proxy public coupe les requêtes longues, et un scan de 25 veilles peut durer
# plusieurs minutes. Le réseau privé Railway est en IPv6 uniquement — le service
# web doit écouter sur `::` (voir HOST dans le Dockerfile).
set -u

BASE="${WEB_INTERNAL_URL:?WEB_INTERNAL_URL manquant}"
SECRET="${CRON_SECRET:?CRON_SECRET manquant}"

# Railway ne résout `${{service.VAR}}` que pour les variables définies par
# l'utilisateur : une référence au PORT injecté par la plateforme arrive ici
# littéralement. Sans ce test, curl échoue sur « nested brace in URL ».
case "$BASE" in
  *'${{'*)
    echo "FAIL WEB_INTERNAL_URL contient une référence Railway non résolue : $BASE"
    echo "     Mettre le port en dur, par exemple http://<service>.railway.internal:8080"
    exit 1
    ;;
esac

# 15 min : marge large pour un scan de veilles, tout en évitant qu'un service
# bloqué laisse tourner le conteneur indéfiniment (facturé à la minute).
TIMEOUT="${CRON_TIMEOUT:-900}"

echecs=0

appeler() {
  chemin="$1"
  reponse=$(mktemp)

  code=$(
    curl --silent --show-error \
      --request POST "$BASE$chemin" \
      --header "Authorization: Bearer $SECRET" \
      --max-time "$TIMEOUT" \
      --output "$reponse" \
      --write-out '%{http_code}'
  ) || code="000"

  if [ "$code" = "200" ]; then
    echo "OK   $chemin — $(cat "$reponse")"
  else
    echo "FAIL $chemin — HTTP $code — $(head -c 500 "$reponse")"
    echecs=$((echecs + 1))
  fi

  rm -f "$reponse"
}

appeler /api/cron/veille
appeler /api/cron/check
appeler /api/cron/rappels

# Sortie non nulle : Railway marque l'exécution en échec et elle devient visible
# dans les logs du service au lieu de passer inaperçue.
[ "$echecs" -eq 0 ] || exit 1
