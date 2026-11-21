#!/bin/sh
# Runs Push & Porter's demo locally in Docker, on made-up data only: the same
# settings (demo/app.ini) and seed (demo/seed.mjs) as the hosted demo.
#
#   dev/run.sh up       # Forgejo, for http://127.0.0.1:3710/demo/
#   dev/run.sh serve    # the site at http://127.0.0.1:3710/ and the demo at /demo/
#   dev/run.sh seed     # made-up people, projects, issues, a pull request
#   dev/run.sh down     # stop and remove the container (data stays)
#   dev/run.sh refresh  # copy a rebuilt theme in and restart
#   dev/run.sh reset    # down, then throw the data away
#
# LOCAL ONLY: SIGNIN=1 dev/run.sh up turns sign-in back on, and
# SIGNIN=1 dev/run.sh seed then prints a password for ac00, so you can look
# at signed-in pages. The hosted demo never uses this.
#
# After node scripts/build.mjs, dev/run.sh refresh copies the theme in again
# and restarts Forgejo.
set -eu
cd "$(dirname "$0")/.."
IMAGE=codeberg.org/forgejo/forgejo:17.0.1-rootless
NAME=${NAME:-cmu-web-push-and-porter-dev}
PORT=${PORT:-3700}
# The local stand-in for nginx (dev/serve.mjs): the site at /, Forgejo at /demo/
PROXY=${PROXY:-3710}
DATA=${DATA:-$PWD/dev/data}
SIGNIN=${SIGNIN:-}

# The theme and the demo's extras, copied into the data folder's custom/
copy_theme() {
  mkdir -p "$DATA/custom/conf"
  rm -rf "$DATA/custom/public" "$DATA/custom/templates" "$DATA/custom/options"
  cp -R custom/public custom/templates custom/options "$DATA/custom/"
  cp demo/theme-push-and-porter-demo.css "$DATA/custom/public/assets/css/"
  cp -R demo/templates/. "$DATA/custom/templates/"
  # The image reads its settings from custom/conf/app.ini in its data folder.
  # A fresh copy every time: Forgejo writes SIGNIN's overrides into it.
  cp demo/app.ini "$DATA/custom/conf/app.ini"
}

case "${1:-}" in
up)
  copy_theme
  set -- -e FORGEJO__server__ROOT_URL="http://127.0.0.1:$PROXY/demo/"
  if [ -n "$SIGNIN" ]; then
    echo "LOCAL ONLY: sign-in is on"
    set -- "$@" -e FORGEJO__service__ENABLE_INTERNAL_SIGNIN=true \
      -e FORGEJO__ui__THEMES=push-and-porter,push-and-porter-demo \
      -e FORGEJO__ui__DEFAULT_THEME=push-and-porter
  fi
  docker run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" \
    -v "$DATA:/var/lib/gitea" \
    "$@" "$IMAGE" >/dev/null
  echo "Forgejo on http://127.0.0.1:$PROXY/demo/ (run dev/run.sh serve), and directly on :$PORT"
  ;;
refresh)
  # After a rebuild: CSS shows on reload; templates and labels need a restart
  copy_theme
  docker restart "$NAME" >/dev/null && echo "restarted"
  ;;
seed)
  node demo/seed.mjs "http://127.0.0.1:$PORT" docker exec "$NAME"
  if [ -n "$SIGNIN" ]; then
    pw=$(head -c 18 /dev/urandom | base64 | tr -d '/+=')
    docker exec "$NAME" forgejo admin user change-password --username ac00 \
      --password "$pw" --must-change-password=false >/dev/null
    echo "LOCAL ONLY: sign in as ac00 with $pw"
  fi
  ;;
serve) node dev/serve.mjs "$PROXY" "$PORT" ;;
down) docker rm -f "$NAME" >/dev/null && echo stopped ;;
reset) docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$DATA"; echo "data removed" ;;
*) echo "usage: dev/run.sh up|seed|refresh|serve|down|reset" >&2; exit 2 ;;
esac
