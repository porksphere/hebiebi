/**
 * The page's line to the shell, as `window.hebiebiDesktop` (typed for the app in
 * src/lib/desktop.ts). Sandboxed, so `electron`'s renderer half is all it can reach.
 */
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("hebiebiDesktop", {
  platform: process.platform,
  /** The app's own small files (settings, the outbox, caches), kept in the shell's data folder.
   *  `read` is synchronous: the app reads some of them before its first frame. */
  files: {
    read: (name: string) => ipcRenderer.sendSync("file-read", name) as string | null,
    write: (name: string, text: string) => ipcRenderer.invoke("file-write", name, text) as Promise<void>,
  },
  /** The personal access token, encrypted with the OS keyring where there is one. */
  token: {
    get: () => ipcRenderer.invoke("token-get") as Promise<string | null>,
    set: (token: string) => ipcRenderer.invoke("token-set", token) as Promise<void>,
    delete: () => ipcRenderer.invoke("token-delete") as Promise<void>,
  },
});
