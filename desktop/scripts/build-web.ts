/**
 * The renderer: the app's own `expo export --platform web`, written to `build/web`.
 */
import { $ } from "bun";
import { rm } from "node:fs/promises";
import { join } from "node:path";

const DESKTOP = join(import.meta.dir, "..");
const OUT = join(DESKTOP, "build", "web");

await rm(OUT, { recursive: true, force: true });
await $`bunx expo export --platform web --output-dir ${OUT}`.cwd(join(DESKTOP, ".."));
console.log(`web export → ${OUT}`);
