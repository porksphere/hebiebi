#!/usr/bin/env bash
# Publishes the desktop app to its rolling GitHub Release (`desktop-nightly`): the AppImage, and
# latest-linux.yml, the feed the installed app's updater reads (desktop/src/updater.ts). The URLs
# never change, so the download link and the feed stay put.
#
# The Release is created once and its assets replaced in place. The AppImage goes up before the
# feed: an updater that reads the old feed in between finds a file that fails its checksum, gives
# up, and tries again at its next check, which is harmless. The other order could point it at a
# feed whose file isn't there yet.
#
# Usage: publish-desktop-channel.sh <dir> <version> <commit>
#   <dir> holds hebiebi-x86_64.AppImage and latest-linux.yml, as electron-builder wrote them.
# Requires gh, GH_TOKEN with contents: write, and GITHUB_REPOSITORY.
set -euo pipefail

USAGE="usage: publish-desktop-channel.sh <dir> <version> <commit>"
DIR="${1:?$USAGE}"
VERSION="${2:?$USAGE}"
COMMIT="${3:?$USAGE}"
REPO="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY not set}"
CHANNEL="desktop-nightly"
BASE="https://github.com/${REPO}/releases/download/${CHANNEL}"

APPIMAGE="$DIR/hebiebi-x86_64.AppImage"
FEED="$DIR/latest-linux.yml"
for f in "$APPIMAGE" "$FEED"; do
  [ -f "$f" ] || { echo "::error::$f not found"; exit 1; }
done
# The feed names the version it describes; it has to be this build's.
grep -qx "version: ${VERSION}" "$FEED" || { echo "::error::$FEED is not for ${VERSION}"; cat "$FEED"; exit 1; }

BODY="Unofficial WaniKani client for the desktop, built from main on every push. Linux only for now.

**Download:** \`${BASE}/hebiebi-x86_64.AppImage\`, then \`chmod +x\` it and run it. It updates
itself from here: a new build downloads in the background and installs when you quit.

If it exits with a libfuse error, install \`libfuse2\` (Ubuntu 22.04+ leaves it out), or run it with
\`--appimage-extract-and-run\`.

${VERSION}, built from ${COMMIT:0:7}."

# A prerelease, so it never takes the repo's "Latest" badge from a tagged version.
if ! gh release view "$CHANNEL" --repo "$REPO" >/dev/null 2>&1; then
  gh release create "$CHANNEL" --repo "$REPO" --target "$COMMIT" --prerelease \
    --title "Hebiebi desktop — latest main" --notes "First publish in progress."
fi

gh release upload "$CHANNEL" "$APPIMAGE" --repo "$REPO" --clobber
gh release upload "$CHANNEL" "$FEED" --repo "$REPO" --clobber
gh api -X PATCH "repos/${REPO}/git/refs/tags/${CHANNEL}" -f sha="$COMMIT" -F force=true >/dev/null
gh release edit "$CHANNEL" --repo "$REPO" --notes "$BODY"

echo "Published ${CHANNEL} -> ${VERSION} (${COMMIT:0:7})"
