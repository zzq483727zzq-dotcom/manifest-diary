type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): KeyValueStorage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function safeStorageGetItem(key: string, storage = browserStorage()): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeStorageSetItem(key: string, value: string, storage = browserStorage()): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Persistence is optional for browser privacy modes and embedded contexts.
  }
}

export function safeStorageRemoveItem(key: string, storage = browserStorage()): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Persistence is optional for browser privacy modes and embedded contexts.
  }
}
