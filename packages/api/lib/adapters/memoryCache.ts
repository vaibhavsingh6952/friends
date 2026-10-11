import type { ResultCache } from "../ports.js";
import type { FriendData } from "../domain/types.js";

interface CacheEntry {
  data: FriendData[];
  totalFollowing: number;
  fetchedAt: string;
}

export class MemoryCache implements ResultCache {
  private store = new Map<string, CacheEntry>();

  async get(key: string): Promise<CacheEntry | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: CacheEntry): Promise<void> {
    this.store.set(key, value);
  }
}