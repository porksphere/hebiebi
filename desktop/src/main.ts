/**
 * Electron main process: the app's `expo export --platform web` output in a window.
 *
 * The export is served from a privileged `app://hebiebi/` scheme rather than `file://`: Expo's web
 * bundle asks for `/_expo/...` from the root, expo-router wants real paths it can reload on, and a
 * fixed origin keeps the page's storage the same from launch to launch.
 */
import { app, BrowserWindow, net, protocol, session, shell } from "electron";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { registerDesktopEntry } from "./desktop-entry.ts";
import { registerStorage } from "./storage.ts";
import { startAutoUpdate } from "./updater.ts";

const ORIGIN = "app://hebiebi";

/** Set by `bun run dev`: Metro's web server, so the window hot-reloads. */
const DEV_URL = process.env.HEBIEBI_DEV_URL;

/** Resolved at runtime from the app's path (the asar root when packaged), never `__dirname`, which
 *  the bundler inlines as the source file's folder. */
const webRoot = (): string => join(app.getAppPath(), "build", "web");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

/** One file out of the export. Anything without a file of its own is a route: the single-page
 *  export's index.html answers it, and expo-router takes it from there. */
function serveExport(request: Request): Promise<Response> {
  const root = webRoot();
  const path = normalize(decodeURIComponent(new URL(request.url).pathname)).replace(/^[/\\]+/, "");
  let target = join(root, path);
  if (target !== root && !target.startsWith(root + sep)) return Promise.resolve(new Response("forbidden", { status: 403 }));
  const isFile = (() => {
    try {
      return statSync(target).isFile();
    } catch {
      return false;
    }
  })();
  if (!isFile) {
    // A missing script or image is a 404, not the page: answered with HTML it fails confusingly.
    if (extname(target)) return Promise.resolve(new Response("not found", { status: 404 }));
    target = join(root, "index.html");
  }
  return net.fetch(pathToFileURL(target).href);
}

/** WaniKani's public item pages (radical illustrations, Patterns of Use: src/lib/wanikani/
 *  subject-page-cache.ts) send no CORS headers, so a page may not read them; a phone has no such
 *  rule. The app fetches them without credentials, so allowing any origin is enough. The API does
 *  send CORS headers but exposes none of its own, and the client reads `RateLimit-Reset`. */
function allowWaniKaniReads(): void {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["https://www.wanikani.com/*", "https://api.wanikani.com/*"] },
    (details, callback) => {
      const headers = Object.fromEntries(
        Object.entries(details.responseHeaders ?? {}).filter(([name]) => !/^access-control-(allow-origin|expose-headers)$/i.test(name)),
      );
      headers["Access-Control-Allow-Origin"] = ["*"];
      headers["Access-Control-Expose-Headers"] = ["*"];
      callback({ responseHeaders: headers });
    },
  );
}

// --- Window size and place, kept between launches -------------------------------------------------

type Bounds = { x: number; y: number; width: number; height: number };
const stateFile = () => join(app.getPath("userData"), "window-state.json");

function savedBounds(): Bounds | null {
  try {
    const saved = JSON.parse(readFileSync(stateFile(), "utf8")) as Bounds;
    return [saved.x, saved.y, saved.width, saved.height].every(Number.isFinite) ? saved : null;
  } catch {
    return null;
  }
}

// --- The window ------------------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;

function isOwnPage(url: string): boolean {
  return url.startsWith(`${ORIGIN}/`) || (!!DEV_URL && url.startsWith(DEV_URL));
}

async function openWindow(): Promise<void> {
  const bounds = savedBounds();
  const win = new BrowserWindow({
    // Phone-shaped to start with: the app's screens are laid out for one.
    width: bounds?.width ?? 520,
    height: bounds?.height ?? 900,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: 360,
    minHeight: 560,
    title: "Hebiebi",
    icon: join(app.getAppPath(), "build", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(app.getAppPath(), "build", "preload.cjs"),
    },
  });
  mainWindow = win;
  win.once("ready-to-show", () => win.show());
  win.on("close", () => {
    try {
      writeFileSync(stateFile(), JSON.stringify(win.getNormalBounds()));
    } catch {
      // Not saved: next launch opens at the default size.
    }
  });
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  // Links out (WaniKani's site, the token page) belong in the browser, not a window with no address
  // bar or back button.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (isOwnPage(url)) return;
    event.preventDefault();
    if (/^https?:/.test(url)) void shell.openExternal(url);
  });

  if (process.env.HEBIEBI_DEBUG || process.env.HEBIEBI_CAPTURE) {
    win.webContents.on("console-message", (e) => console.log(`[renderer:${e.level}] ${e.message}`));
    win.webContents.on("did-fail-load", (_e, code, desc, url) => console.error(`[renderer] ${code} ${desc} ${url}`));
  }

  await win.loadURL(DEV_URL ?? `${ORIGIN}/`);

  // A check that the window really renders the app, not a blank page: with HEBIEBI_CAPTURE set to
  // a path, wait for the UI to settle, write a screenshot there, print what's on the page, and quit.
  if (process.env.HEBIEBI_CAPTURE) {
    await new Promise((r) => setTimeout(r, Number(process.env.HEBIEBI_CAPTURE_DELAY ?? 5000)));
    const probe = await win.webContents.executeJavaScript(
      `JSON.stringify({ title: document.title, nodes: document.body.querySelectorAll('*').length, text: (document.body.innerText || '').slice(0, 300) })`,
    );
    console.log(`[capture] ${probe}`);
    // The probe is the check; the screenshot is for looking at. A display with no GPU (CI's xvfb)
    // can refuse it with UnknownVizError while the page itself rendered fine.
    try {
      await writeFile(process.env.HEBIEBI_CAPTURE, (await win.webContents.capturePage()).toPNG());
    } catch (err) {
      console.warn("[capture] no screenshot:", err);
    }
    app.exit(JSON.parse(probe).nodes > 10 ? 0 : 1);
  }
}

// --- Start-up ------------------------------------------------------------------------------------

// A dev run keeps data of its own, so it never shares a token or an outbox with the installed app.
if (!app.isPackaged) app.setPath("userData", `${app.getPath("userData")}-dev`);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app
    .whenReady()
    .then(() => {
      protocol.handle("app", serveExport);
      registerStorage();
      allowWaniKaniReads();
      startAutoUpdate();
      registerDesktopEntry().catch((err: unknown) => console.error("[desktop-entry]", err));
      return openWindow();
    })
    .catch((err: unknown) => {
      console.error("hebiebi-desktop failed to start:", err);
      app.exit(1);
    });

  app.on("window-all-closed", () => app.quit());
}
