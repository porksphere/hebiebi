/**
 * What the page keeps through the shell: its small files (src/lib/document-file.web.ts) and the
 * token (src/lib/token-store.web.ts). All of it under Electron's `userData`.
 */
import { app, ipcMain, safeStorage } from "electron";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The app names its files itself (`outbox-reviews.json`, …); nothing else gets near the disk. */
const SAFE_NAME = /^[\w-][\w.-]*$/;

const documents = () => join(app.getPath("userData"), "documents");
const tokenFile = () => join(app.getPath("userData"), "token");

function pathFor(name: unknown): string {
  if (typeof name !== "string" || !SAFE_NAME.test(name)) throw new Error(`not a document name: ${String(name)}`);
  return join(documents(), name);
}

/** Written beside and renamed over, so a crash mid-write leaves the old file rather than half of one. */
function writeAtomic(path: string, data: string | Buffer): void {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, data, { mode: 0o600 });
  renameSync(temp, path);
}

export function registerStorage(): void {
  mkdirSync(documents(), { recursive: true });

  ipcMain.on("file-read", (e, name: unknown) => {
    try {
      e.returnValue = readFileSync(pathFor(name), "utf8");
    } catch {
      e.returnValue = null;
    }
  });
  ipcMain.handle("file-write", (_e, name: unknown, text: unknown) => {
    if (typeof text !== "string") throw new Error("file-write takes text");
    writeAtomic(pathFor(name), text);
  });

  // Where Linux has no keyring (no gnome-keyring / KWallet running), safeStorage falls back to a
  // fixed key, or isn't available at all; then the file's 0600 mode is what protects it.
  ipcMain.handle("token-get", () => {
    let raw: Buffer;
    try {
      raw = readFileSync(tokenFile());
    } catch {
      return null;
    }
    if (raw.subarray(0, 6).toString() === "plain:") return raw.subarray(6).toString();
    try {
      return safeStorage.decryptString(raw);
    } catch {
      return null;
    }
  });
  ipcMain.handle("token-set", (_e, token: unknown) => {
    if (typeof token !== "string") throw new Error("token-set takes a string");
    const data = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(token)
      : Buffer.from(`plain:${token}`);
    writeAtomic(tokenFile(), data);
  });
  ipcMain.handle("token-delete", () => rmSync(tokenFile(), { force: true }));
}
