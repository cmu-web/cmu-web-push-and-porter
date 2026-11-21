#!/bin/sh
# Builds the service description (docs/) into docs/_site with a local
# Jekyll & Plaid checkout, for a look before Jekyll & Plaid's next release.
# The Attach Release Files workflow builds it with remote_theme instead.
#
#   dev/site.sh            # then dev/run.sh serve: http://127.0.0.1:3710/
#   JP=/path/to/cmu-web-jekyll-and-plaid dev/site.sh
set -eu
cd "$(dirname "$0")/.."
JP=${JP:-$PWD/../cmu-web-jekyll-and-plaid}
W=$(mktemp -d)
cp -R docs/. "$W/"
rm -rf "$W/_site"
for d in _layouts _includes assets; do cp -R "$JP/$d" "$W/"; done
sed -i 's/^remote_theme:.*$//' "$W/_config.yml"
(cd "$W" && PAGES_REPO_NWO=cmu-web/cmu-web-push-and-porter JEKYLL_GITHUB_TOKEN= \
  BUNDLE_GEMFILE="$JP/Gemfile" BUNDLE_PATH="$JP/vendor/bundle" \
  bundle exec jekyll build -q -d "$PWD/_site" 2>&1 | grep -v -i 'warn\|faraday' || true)
rm -rf docs/_site && mv "$W/_site" docs/_site && rm -rf "$W"
echo "built docs/_site"
