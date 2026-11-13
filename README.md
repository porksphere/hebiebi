# Hebiebi 蛇

An unofficial, third-party iOS client for [WaniKani](https://www.wanikani.com). Not made or
endorsed by WaniKani or Tofugu.

Expo (SDK 58) + React Native, with native platform UI: the system tab bar and navigation bars, and
`@expo/ui` forms, which render SwiftUI on iOS and Jetpack Compose on Android.

## What it does (first pass)

- **Sign in** with a WaniKani personal access token, stored in the iOS Keychain. WaniKani's API only
  allows tokens for third-party apps. Create one at
  <https://www.wanikani.com/settings/personal_access_tokens/new> with **reviews:create** ticked (and
  **user:update** if you want to change review settings from the app).
- **Today**: the reviews that are ready, over a big faint kanji picked from them. Below it, your
  level as a sheet of kanji practice paper: a square is empty until the kanji unlocks, grey while
  you learn it and black once it's passed. One line covers what's next and any lessons.
- **Reviews**, behaving like WaniKani's own:
  - Romaji is converted to kana as you type a reading.
  - Typos in meanings are tolerated in proportion to word length. Blacklisted meanings are wrong,
    and your own synonyms count as right.
  - Some answers get a no-penalty retry instead of a fail: the reading typed instead of the meaning,
    the other reading type of a kanji ("we're looking for the on'yomi"), a small-kana slip, or a
    verb missing its "to".
  - 10 items are in rotation, with meaning and reading asked in random order.
  - Wrap-up: finish the 10 items in play, then stop.
  - Undo by pressing and holding the characters after answering (before Next). It's slow on
    purpose, so it can't happen by accident.
  - Minimise a session to look around the app. It waits on the Today screen and, on iOS 26, in a
    bar above the tabs; end it from either.
  - Review order (shuffled or lower levels first) is read fresh from your account for each session.
  - Item info after answering, with mnemonics, hints, readings, audio and context sentences. Parts
    not yet asked stay hidden.
  - A summary at the end showing each item's new SRS stage.
- Each finished item's review is saved on the phone first and then sent, so a dropped connection
  doesn't lose work. Unsent reviews retry the next time the app opens.
- **Levels**: all sixty levels on one ruled sheet. A level shows its radicals and kanji on the same
  practice paper as Today and its vocabulary as a list; what you haven't unlocked is blank or faint.
- **Search** (the tab bar's search button): by meaning, reading (kana or romaji) or characters.
  The first search downloads a slim list of every subject (about 1–2 MB) and keeps it on the phone;
  after that only changes are fetched.
- **Settings**: account info, review preferences (synced with WaniKani), theme (system, light or
  dark), and sign out.

Not yet: lessons, item browsing and search, extra study, widgets, notifications.

## Development

Requires [mise](https://mise.jdx.dev) (or Bun and Node at the versions in `mise.toml`).

```bash
mise install
bun install
bun start          # Metro, for the dev client
bun run typecheck
bun run lint
bun test           # answer checker + review queue
```

There's no Mac here. Native builds happen on GitHub Actions, and you install them with
AltStore/SideStore.

### Installing on an iPhone (AltStore / SideStore)

| Source | What | Built |
| --- | --- | --- |
| `https://github.com/porksphere/hebiebi/releases/download/ios-nightly/apps.json` | The app (Release) | Every push to `main` that touches the app |
| `https://github.com/porksphere/hebiebi/releases/download/ios-devclient/apps.json` | Dev client (Debug + expo-dev-client) | Manually: Actions → *Build iOS dev client* → Run |

Add a source in AltStore/SideStore under Sources → +. The IPAs are unsigned; AltStore re-signs them
with your Apple ID on the device.

Both builds share the bundle id `com.porksphere.hebiebi`. Installing one replaces the other and
keeps your data and sign-in, and they use only one of a free Apple ID's three app slots.

### Iterating with the dev client

1. Install the dev client from its source. Rebuild it only after native changes: a new native
   module, a config plugin, or an SDK bump.
2. Run `bun start` on your computer, with the phone on the same network. A Tailscale-style VPN
   address works too: the dev client allows plain-HTTP loads.
3. Open **Hebiebi (dev)** and pick the server, or enter its URL.

JS and TS changes then hot-reload over Metro with no rebuild.

### CI

- `checks.yml`: typecheck, lint and tests on Linux, for every push and PR.
- `build-ios.yml`: builds a Release IPA on macOS for pushes to `main` and for PRs. Only `main`
  publishes it.
- `build-ios-devclient.yml`: builds and publishes the dev client when run manually.
- `build-ios-reusable.yml`: the shared build. Its caches (Bun, CocoaPods, and ccache with React
  Native's Xcode 26 wrapper fix) come from comical-app. Only `main` writes caches; PRs restore
  main's read-only.
