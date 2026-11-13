#!/usr/bin/env bash
# Prints the version string a build stamps into its binary: `<app.json version>.<N>`, where N counts
# the commits since the one that last changed `expo.version`, plus one. So the first build after
# bumping to 0.2.0 is 0.2.0.1, the next 0.2.0.2, and bumping again starts over at .1.
#
# AltStore/SideStore compare versions part by part, so 0.2.0.1 still beats 0.1.0.57: moving the
# base up outranks the counter resetting. Within a series N only climbs.
#
# Ported from comical-app's script of the same name (which explains the history in more depth).
# Needs full git history (fetch-depth: 0).
set -euo pipefail

APP_JSON="app.json"

if [ -n "${VERSION_INPUT:-}" ]; then
  echo "$VERSION_INPUT"
  exit 0
fi

BASE="$(node -p "require('./${APP_JSON}').expo.version")"

if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  echo "::error::compute-build-version.sh needs full history. Set fetch-depth: 0 on the checkout." >&2
  exit 1
fi

version_at() {
  git show "$1:${APP_JSON}" 2>/dev/null | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).expo.version" 2>/dev/null || true
}

# The newest first-parent commit that carries the base while its parent doesn't.
BUMP=""
while read -r sha; do
  [ -n "$sha" ] || continue
  [ "$(version_at "$sha")" = "$BASE" ] || continue
  [ "$(version_at "${sha}^")" = "$BASE" ] && continue
  BUMP="$sha"
  break
done < <(git log --first-parent --format=%H -- "$APP_JSON")

if [ -n "$BUMP" ]; then
  COUNT="$(git rev-list --count "${BUMP}..HEAD")"
else
  COUNT="$(git rev-list --count HEAD)"
  echo "::warning::No commit found introducing version ${BASE}; using the total commit count." >&2
fi

echo "${BASE}.$((COUNT + 1))"
