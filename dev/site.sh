#!/bin/sh
# Builds the service description (site/) into site/_site with a local
# Jekyll & Plaid checkout, for a look before Jekyll & Plaid's next release.
# The release workflow builds it with remote_theme instead.
#
#   dev/site.sh            # then dev/run.sh serve: http://127.0.0.1:3710/
#   JP=/path/to/cmu-web-jekyll-and-plaid dev/site.sh
set -eu
cd "$(dirname "$0")/.."
JP=${JP:-$PWD/../cmu-web-jekyll-and-plaid}
W=$(mktemp -d)
cp -R site/. "$W/"
rm -rf "$W/_site"
for d in _layouts _includes assets; do cp -R "$JP/$d" "$W/"; done
sed -i 's/^remote_theme:.*$//' "$W/_config.yml"
(cd "$W" && PAGES_REPO_NWO=cmu-web/cmu-web-hamerschlag JEKYLL_GITHUB_TOKEN= \
  BUNDLE_GEMFILE="$JP/Gemfile" BUNDLE_PATH="$JP/vendor/bundle" \
  bundle exec jekyll build -q -d "$PWD/_site" 2>&1 | grep -v -i 'warn\|faraday' || true)
rm -rf site/_site && mv "$W/_site" site/_site && rm -rf "$W"
echo "built site/_site"
