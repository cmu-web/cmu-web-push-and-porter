#!/bin/sh
# Runs Forgejo with the theme for a local look, on made-up data only.
#
#   dev/run.sh up       # http://127.0.0.1:3700/ (PORT=... to change)
#   dev/run.sh seed     # made-up users, repos, issues and a pull request
#   dev/run.sh down     # stop and remove the container (data stays)
#
# Data goes in dev/data (or DATA=...). The theme's custom/public and
# custom/templates are mounted read-only, so a rebuild shows on reload.
set -eu
cd "$(dirname "$0")/.."
IMAGE=codeberg.org/forgejo/forgejo:17.0.1-rootless
NAME=${NAME:-cmu-web-forgejo-dev}
PORT=${PORT:-3700}
DATA=${DATA:-$PWD/dev/data}

case "${1:-}" in
up)
  mkdir -p "$DATA/custom/conf"
  docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" \
    -v "$DATA:/var/lib/gitea" \
    -v "$PWD/custom/public:/var/lib/gitea/custom/public:ro" \
    -v "$PWD/custom/templates:/var/lib/gitea/custom/templates:ro" \
    -e FORGEJO__security__INSTALL_LOCK=true \
    -e FORGEJO__database__DB_TYPE=sqlite3 \
    -e FORGEJO__server__ROOT_URL="http://127.0.0.1:$PORT/" \
    -e FORGEJO__server__OFFLINE_MODE=true \
    -e FORGEJO____APP_NAME="CMU Code" \
    -e FORGEJO__ui__THEMES="cmu,forgejo-auto,forgejo-light,forgejo-dark" \
    -e FORGEJO__ui__DEFAULT_THEME=cmu \
    -e FORGEJO__service__DISABLE_REGISTRATION=true \
    -e FORGEJO__mailer__ENABLED=false \
    -e FORGEJO__other__SHOW_FOOTER_TEMPLATE_LOAD_TIME=false \
    "$IMAGE" >/dev/null
  echo "Forgejo on http://127.0.0.1:$PORT/"
  ;;
seed) node dev/seed.mjs "http://127.0.0.1:$PORT" "$NAME" ;;
down) docker rm -f "$NAME" >/dev/null && echo stopped ;;
*) echo "usage: dev/run.sh up|seed|down" >&2; exit 2 ;;
esac
