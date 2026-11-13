#!/usr/bin/env bash
# Publishes an AltStore/SideStore source on a GitHub Release: the IPA, an apps.json manifest that
# points at it, and the app icon. One version per source, because the Release holds one IPA: an
# older manifest entry would serve the newer binary under the older version string, and AltStore
# rejects that mismatch.
#
# The Release is created once and its assets replaced in place, so the source URL never 404s for
# someone refreshing mid-publish.
#
# Usage: publish-ios-source.sh <channel> <ipa> <version> <commit>
#   channel   ios-nightly | ios-devclient   (also the Release tag)
# Requires gh + jq, GH_TOKEN with contents: write, and GITHUB_REPOSITORY.
set -euo pipefail

USAGE="usage: publish-ios-source.sh <channel> <ipa> <version> <commit>"
CHANNEL="${1:?$USAGE}"
IPA="${2:?$USAGE}"
VERSION="${3:?$USAGE}"
COMMIT="${4:?$USAGE}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY not set}"
OWNER="${REPO%%/*}"
BASE="https://github.com/${REPO}/releases/download/${CHANNEL}"
BUNDLE_ID="$(node -p "require('./app.json').expo.ios.bundleIdentifier")"
WORK="$(mktemp -d)"

case "$CHANNEL" in
  ios-nightly)
    APP_NAME="Hebiebi"
    IPA_NAME="hebiebi.ipa"
    SOURCE_NAME="Hebiebi"
    TITLE="Hebiebi iOS — latest main"
    DESC="Unofficial WaniKani client. Built from main on every push. Unsigned; AltStore/SideStore re-signs it on your device."
    NOTES="Built from ${COMMIT:0:7}."
    ;;
  ios-devclient)
    APP_NAME="Hebiebi (dev)"
    IPA_NAME="hebiebi-devclient.ipa"
    SOURCE_NAME="Hebiebi (dev client)"
    TITLE="Hebiebi iOS — dev client"
    DESC="Development client: loads JavaScript from your Metro server (bun start). Same bundle id as the regular app, so it replaces it and shares its data. Rebuild only when native code changes."
    NOTES="Dev client built from ${COMMIT:0:7}. Run \`bun start\` and connect from the launcher."
    ;;
  *)
    echo "::error::unknown channel $CHANNEL"
    exit 1
    ;;
esac

[ -f "$IPA" ] || { echo "::error::IPA not found at $IPA"; exit 1; }
cp "$IPA" "$WORK/$IPA_NAME"
cp assets/images/icon.png "$WORK/icon.png"

# Top-level legacy fields mirror versions[0] for older clients; current AltStore/SideStore read
# versions[]. jq does the escaping.
jq -n \
  --arg sourceName "$SOURCE_NAME" \
  --arg identifier "${BUNDLE_ID}.source.${CHANNEL#ios-}" \
  --arg appName "$APP_NAME" \
  --arg bundleId "$BUNDLE_ID" \
  --arg developer "$OWNER" \
  --arg desc "$DESC" \
  --arg version "$VERSION" \
  --arg date "$(date -u +%Y-%m-%d)" \
  --arg notes "$NOTES" \
  --arg dl "${BASE}/${IPA_NAME}" \
  --argjson size "$(stat -c%s "$IPA")" \
  --arg icon "${BASE}/icon.png" \
  '{
    name: $sourceName,
    identifier: $identifier,
    apps: [{
      name: $appName,
      bundleIdentifier: $bundleId,
      developerName: $developer,
      localizedDescription: $desc,
      iconURL: $icon,
      tintColor: "000000",
      versions: [{version: $version, date: $date, localizedDescription: $notes, downloadURL: $dl, size: $size}],
      version: $version,
      versionDate: $date,
      versionDescription: $notes,
      downloadURL: $dl,
      size: $size
    }]
  }' > "$WORK/apps.json"

BODY="${DESC}

**Install via source:** in AltStore or SideStore, Sources → + and add
\`${BASE}/apps.json\`

**Or grab the IPA directly:** \`${BASE}/${IPA_NAME}\`

${NOTES}"

# A prerelease, so it never takes the repo's "Latest" badge from a tagged version.
if ! gh release view "$CHANNEL" --repo "$REPO" >/dev/null 2>&1; then
  gh release create "$CHANNEL" --repo "$REPO" --target "$COMMIT" --prerelease \
    --title "$TITLE" --notes "First publish in progress."
fi

gh release upload "$CHANNEL" "$WORK/$IPA_NAME" "$WORK/apps.json" "$WORK/icon.png" --repo "$REPO" --clobber
# Move the tag to the commit the IPA came from.
gh api -X PATCH "repos/${REPO}/git/refs/tags/${CHANNEL}" -f sha="$COMMIT" -F force=true >/dev/null
gh release edit "$CHANNEL" --repo "$REPO" --notes "$BODY"

echo "Published ${CHANNEL} -> ${VERSION} (${COMMIT:0:7})"
echo "Source: ${BASE}/apps.json"
