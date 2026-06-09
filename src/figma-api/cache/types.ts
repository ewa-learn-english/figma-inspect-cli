export interface CacheEntry {
  url: string;
  cachedAt: number;
  version?: string;
  lastModified?: string;
  etag?: string;
  body: unknown;
}

export interface FileVersionEntry {
  version: string;
  lastModified?: string;
  checkedAt: number;
}

export interface FetchedResponse {
  body: unknown;
  version?: string;
  lastModified?: string;
  etag?: string;
}
