/**
 * Bundle the main process and the preload into `build/`, each one CJS file. `electron` stays
 * external (the runtime provides it); electron-updater and its dependencies are inlined, so the
 * packaged app needs no node_modules.
 */
import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const DESKTOP = join(import.meta.dir, "..");
const OUT = join(DESKTOP, "build");
await mkdir(OUT, { recursive: true });

// The preload runs sandboxed, where `require` reaches nothing but `electron`, so it's a bundle of
// its own rather than a chunk of main's.
for (const name of ["main", "preload"]) {
  const outfile = join(OUT, `${name}.cjs`);
  await rm(outfile, { force: true });
  const result = await Bun.build({
    entrypoints: [join(DESKTOP, "src", `${name}.ts`)],
    target: "node",
    format: "cjs",
    external: ["electron"],
    outdir: OUT,
    naming: `${name}.cjs`,
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error(`${name} bundle failed`);
  }
  console.log(`${name} → ${outfile}`);
}

// The window's icon (src/main.ts); the package's own comes from electron-builder.yml.
await copyFile(join(DESKTOP, "..", "assets", "images", "icon.png"), join(OUT, "icon.png"));
