/**
 * Render the Linux icon sizes from the app icon (assets/images/icon.png, 1024px) into
 * desktop/assets/icons, which electron-builder packs into the AppImage one size per hicolor folder.
 *
 *   bun run icons        (needs libvips' `vips`; then commit what lands in assets/icons)
 *
 * The packed 1024px alone wasn't enough: desktops look an icon up by name in the hicolor theme,
 * whose folders stop at 512x512, so KDE found no icon for the app at all.
 */
import { $ } from "bun";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const DESKTOP = join(import.meta.dir, "..");
const SOURCE = join(DESKTOP, "..", "assets", "images", "icon.png");
const OUT = join(DESKTOP, "assets", "icons");
const SIZES = [16, 22, 24, 32, 48, 64, 128, 256, 512];

await mkdir(OUT, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT, `${size}x${size}.png`);
  await $`vips thumbnail ${SOURCE} ${file} ${size}`;
  console.log(file);
}
