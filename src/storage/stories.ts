import type { Story, Collection } from '../types/domain';
import { validateStoryInput } from '../domain/storyValidator';

const STORIES_DB_NAME = 'krakinai_stories_db';
const STORIES_DB_VERSION = 1;
const STORIES_STORE_NAME = 'stories';

export function openStoriesDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(STORIES_DB_NAME, STORIES_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORIES_STORE_NAME)) {
        const store = db.createObjectStore(STORIES_STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('favorite', 'favorite');
        store.createIndex('archivedAt', 'archivedAt');
        store.createIndex('linkedCollectionId', 'linkedCollectionId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open stories database.'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Transaction failed.'));
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted.'));
  });
}

export async function saveStory(story: Story): Promise<void> {
  validateStoryInput(story);
  const db = await openStoriesDatabase();
  const tx = db.transaction(STORIES_STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORIES_STORE_NAME);
  store.put(story);
  await txDone(tx);
}

export async function getStory(id: string): Promise<Story | undefined> {
  const db = await openStoriesDatabase();
  const tx = db.transaction(STORIES_STORE_NAME, 'readonly');
  const store = tx.objectStore(STORIES_STORE_NAME);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as Story | undefined);
    req.onerror = () => reject(req.error);
  });
}

export interface ListStoriesOptions {
  query?: string;
  tag?: string;
  favorite?: boolean;
  archiveFilter?: 'active' | 'archived' | 'all';
}

export async function listStories(options?: ListStoriesOptions): Promise<Story[]> {
  const db = await openStoriesDatabase();
  const tx = db.transaction(STORIES_STORE_NAME, 'readonly');
  const store = tx.objectStore(STORIES_STORE_NAME);

  const allStories: Story[] = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as Story[]);
    req.onerror = () => reject(req.error);
  });

  const archiveFilter = options?.archiveFilter ?? (options?.favorite !== undefined ? 'all' : 'active');
  const query = options?.query?.trim().toLowerCase();
  const tag = options?.tag?.trim().toLowerCase();
  const favorite = options?.favorite;

  const filtered = allStories.filter((s) => {
    if (archiveFilter === 'active' && s.archivedAt) return false;
    if (archiveFilter === 'archived' && !s.archivedAt) return false;
    if (favorite !== undefined && s.favorite !== favorite) return false;
    if (tag && !s.tags.some((t) => t.toLowerCase() === tag)) return false;
    if (query) {
      const match =
        s.title.toLowerCase().includes(query) ||
        (s.logline && s.logline.toLowerCase().includes(query)) ||
        (s.premise && s.premise.toLowerCase().includes(query)) ||
        (s.synopsis && s.synopsis.toLowerCase().includes(query)) ||
        (s.author && s.author.toLowerCase().includes(query));
      if (!match) return false;
    }
    return true;
  });

  filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return filtered;
}

export async function toggleStoryFavorite(id: string): Promise<Story> {
  const existing = await getStory(id);
  if (!existing) {
    throw new Error(`Story with ID '${id}' not found.`);
  }
  const updated: Story = {
    ...existing,
    favorite: !existing.favorite,
    updatedAt: new Date().toISOString(),
  };
  await saveStory(updated);
  return updated;
}

export async function setStoryArchived(id: string, archived: boolean): Promise<Story> {
  const existing = await getStory(id);
  if (!existing) {
    throw new Error(`Story with ID '${id}' not found.`);
  }
  const updated: Story = {
    ...existing,
    archivedAt: archived ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  };
  await saveStory(updated);
  return updated;
}

export async function deleteStory(id: string, collections?: Collection[]): Promise<void> {
  const existing = await getStory(id);
  if (!existing) return;

  if (existing.linkedCollectionId && collections) {
    const linked = collections.find((c) => c.id === existing.linkedCollectionId);
    if (linked) {
      throw new Error(`Cannot delete story linked to active collection '${linked.id}'.`);
    }
  }

  const db = await openStoriesDatabase();
  const tx = db.transaction(STORIES_STORE_NAME, 'readwrite');
  tx.objectStore(STORIES_STORE_NAME).delete(id);
  await txDone(tx);
}

export async function clearStoriesStoreForTesting(): Promise<void> {
  const db = await openStoriesDatabase();
  const tx = db.transaction(STORIES_STORE_NAME, 'readwrite');
  tx.objectStore(STORIES_STORE_NAME).clear();
  await txDone(tx);
}
