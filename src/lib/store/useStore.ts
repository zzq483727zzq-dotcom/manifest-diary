'use client';

import { useSyncExternalStore, useCallback } from 'react';
import {
  type ClarityDB,
  emptyDB,
  loadDB,
  saveDB,
  cloneDB,
} from '@/lib/store/store';

/**
 * Single in-memory source of truth for the static export build.
 * All client components read through `useStore()`; mutations go through
 * `mutate()` which applies the change, persists to localStorage, and
 * broadcasts to every subscriber (replacing the old `router.refresh()`
 * re-fetch loop).
 *
 * The snapshot returned to React is a stable reference until a mutation
 * actually changes the data, so `useSyncExternalStore` won't loop.
 */

let cache: ClarityDB = loadDB();
let listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === 'undefined') return () => listeners.delete(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === 'clarity-db') {
      cache = loadDB();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): ClarityDB {
  return cache;
}

function getServerSnapshot(): ClarityDB {
  return emptyDB();
}

/** Read the live DB. Re-renders on mutation. */
export function useStore(): ClarityDB {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Apply a pure transform to a private copy and persist it.
 * The mutator receives a fresh clone it may modify in place and return.
 */
export function mutate(transform: (db: ClarityDB) => ClarityDB | void): ClarityDB {
  const draft = cloneDB(cache);
  const result = transform(draft) ?? draft;
  cache = result;
  saveDB(cache);
  emit();
  return cache;
}

/** Force a re-read from localStorage (e.g. after an external import). */
export function reload(): ClarityDB {
  cache = loadDB();
  emit();
  return cache;
}

/** Replace the DB wholesale (used by import). */
export function replaceDB(db: ClarityDB): ClarityDB {
  cache = db;
  saveDB(cache);
  emit();
  return cache;
}

/** Direct read of the current cache without subscribing. */
export function getDB(): ClarityDB {
  return cache;
}

/** Re-export mutate-bound helpers for ergonomics. */
export { useCallback };
