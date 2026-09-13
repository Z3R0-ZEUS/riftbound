export const MUTE_KEY = "riftbound-muted";

export type MuteStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): MuteStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readMuted(storage: MuteStorage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean, storage: MuteStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    void 0;
  }
}
