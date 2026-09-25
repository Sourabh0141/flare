/**
 * Small per-device preferences that do not belong on the server (they describe this
 * browser, not the account). Every access is guarded: private windows and blocked storage
 * must not break the app.
 */
const KEY = 'flare:prefs';

export interface DevicePrefs {
  /** Start the assistant in hands-free mode. */
  handsFreeByDefault: boolean;
  /** Set once the user has seen the first-run tip. */
  seenWelcome: boolean;
}

const defaults: DevicePrefs = { handsFreeByDefault: false, seenWelcome: false };

export function readPrefs(): DevicePrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<DevicePrefs>;
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function writePrefs(patch: Partial<DevicePrefs>): DevicePrefs {
  const next = { ...readPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable; the preference simply does not persist.
  }
  return next;
}
