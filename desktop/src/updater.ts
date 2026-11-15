/**
 * Self-update from the `desktop-nightly` Release (the feed electron-builder.yml names): checks a
 * little after launch and every four hours, downloads in the background, and installs when the app
 * quits. A notice says when one is ready; clicking it restarts into it now.
 *
 * Only an AppImage updates itself: it's a single file the updater can swap. A dev run has nothing
 * to replace.
 */
import { app, Notification } from "electron";
import { autoUpdater } from "electron-updater";

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
/** Off the launch path, which wants the disk and network first. */
const FIRST_CHECK_AFTER_MS = 15 * 1000;

export const updatesSupported = app.isPackaged && process.platform === "linux" && !!process.env.APPIMAGE;

/** Held until clicked or closed, or the garbage collector can take its click handler with it. */
let notice: Notification | null = null;

const check = () => void autoUpdater.checkForUpdates().catch(() => {});

export function startAutoUpdate(): void {
  if (!updatesSupported) return;

  // The AppImage keeps one fixed name, so the "old" blockmap a differential download would diff
  // against is already the new one's: it would fail its checksum and fall back every time.
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", (info) => {
    if (!Notification.isSupported()) return;
    notice?.close();
    notice = new Notification({
      title: "Update ready",
      body: `Hebiebi ${info.version} installs when you quit. Click to restart now.`,
    });
    notice.on("click", () => autoUpdater.quitAndInstall(true, true));
    notice.on("close", () => (notice = null));
    notice.show();
  });
  // Offline, or GitHub unreachable: the next check tries again.
  autoUpdater.on("error", (err) => console.error("[updater]", err.message));

  setTimeout(check, FIRST_CHECK_AFTER_MS);
  setInterval(check, CHECK_EVERY_MS);
}
