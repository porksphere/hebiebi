/**
 * Write the build version into desktop/package.json, which is where electron-builder (and so the
 * app, and its updater) reads it. CI only; git carries 0.0.0.
 *
 * The number is the one the iOS build stamps (.github/scripts/compute-build-version.sh):
 * `X.Y.Z.N`, N counting commits since the last `expo.version` bump. That isn't semver, which
 * electron-builder and electron-updater insist on, so the fourth part becomes a prerelease:
 * `0.1.0.40` → `0.1.0-40`. Semver orders those the way the builds came (`0.1.0-40` < `0.1.0-41` <
 * `0.2.0-1`), which is all the updater compares. It would rank `0.1.0-40` below a plain `0.1.0`,
 * so a build without the counter must never go out on the same feed.
 *
 *   VERSION_INPUT=0.1.0.12 bun run stamp-version   # what CI does
 *   bun run stamp-version                          # or compute it from git history
 */
import { $ } from "bun";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DESKTOP = join(import.meta.dir, "..");

export function toSemver(raw: string): string {
  const four = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(raw);
  return four ? `${four[1]}.${four[2]}.${four[3]}-${four[4]}` : raw;
}

const raw =
  process.env.VERSION_INPUT?.trim() ||
  (await $`bash .github/scripts/compute-build-version.sh`.cwd(join(DESKTOP, "..")).text()).trim();
const version = toSemver(raw);
if (!/^\d+\.\d+\.\d+-\d+$/.test(version)) throw new Error(`refusing to stamp "${raw}" → "${version}": not X.Y.Z-N`);

const path = join(DESKTOP, "package.json");
const pkg = JSON.parse(await readFile(path, "utf8")) as { version: string };
pkg.version = version;
await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(version);
