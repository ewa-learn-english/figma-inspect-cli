import { fetchFigmaResponse } from "../fetch-with-retry.js";
import { FigmaApiError } from "../figma-api-error.js";
import { formatFigmaError } from "../format-figma-error.js";
import { ENTRY_TTL_MS, FILE_VERSION_MAX_AGE_MS } from "./constants.js";
import { extractVersionMetadata } from "./extract-metadata.js";
import { FigmaCacheStore } from "./store.js";
import type { CacheEntry, FetchedResponse } from "./types.js";
import {
  buildFileProbeUrl,
  extractFileKey,
  normalizeRequestUrl,
} from "./url.js";

function isExpired(cachedAt: number, ttlMs: number, now = Date.now()): boolean {
  return now - cachedAt >= ttlMs;
}

async function fetchFromNetwork(
  url: string | URL,
  token: string,
  fetchImpl: typeof fetch,
): Promise<FetchedResponse> {
  const response = await fetchFigmaResponse(url, token, fetchImpl);

  if (!response.ok) {
    throw new FigmaApiError(await formatFigmaError(response));
  }

  const body = await response.json();
  const metadata = extractVersionMetadata(body);

  return {
    body,
    version: metadata.version,
    lastModified: metadata.lastModified,
    etag: response.headers.get("etag") ?? undefined,
  };
}

function buildCacheEntry(
  url: string,
  fetched: FetchedResponse,
  cachedAt = Date.now(),
): CacheEntry {
  return {
    url,
    cachedAt,
    version: fetched.version,
    lastModified: fetched.lastModified,
    etag: fetched.etag,
    body: fetched.body,
  };
}

export class CachedFigmaRequest {
  private readonly store: FigmaCacheStore;

  constructor(private readonly token: string) {
    this.store = new FigmaCacheStore(token);
  }

  async request(url: string | URL, fetchImpl: typeof fetch): Promise<unknown> {
    const canonicalUrl = normalizeRequestUrl(url);
    const entry = await this.store.readEntry(canonicalUrl);

    if (entry && !isExpired(entry.cachedAt, ENTRY_TTL_MS)) {
      return entry.body;
    }

    const fileKey = extractFileKey(canonicalUrl);
    if (entry && fileKey && entry.version !== undefined) {
      const currentVersion = await this.resolveCurrentFileVersion(
        fileKey,
        fetchImpl,
      );
      if (currentVersion === entry.version) {
        await this.store.writeEntry(canonicalUrl, {
          ...entry,
          cachedAt: Date.now(),
        });
        return entry.body;
      }
    }

    const fetched = await fetchFromNetwork(url, this.token, fetchImpl);
    await this.store.writeEntry(
      canonicalUrl,
      buildCacheEntry(canonicalUrl, fetched),
    );

    if (fileKey && fetched.version !== undefined) {
      await this.store.writeFileVersion(fileKey, {
        version: fetched.version,
        lastModified: fetched.lastModified,
        checkedAt: Date.now(),
      });
    }

    return fetched.body;
  }

  private async resolveCurrentFileVersion(
    fileKey: string,
    fetchImpl: typeof fetch,
  ): Promise<string | undefined> {
    const fileVersion = await this.store.readFileVersion(fileKey);
    if (
      fileVersion &&
      !isExpired(fileVersion.checkedAt, FILE_VERSION_MAX_AGE_MS)
    ) {
      return fileVersion.version;
    }

    const probeUrl = buildFileProbeUrl(fileKey);
    const probeEntry = await this.store.readEntry(probeUrl);
    if (
      probeEntry?.version !== undefined &&
      !isExpired(probeEntry.cachedAt, ENTRY_TTL_MS)
    ) {
      await this.store.writeFileVersion(fileKey, {
        version: probeEntry.version,
        lastModified: probeEntry.lastModified,
        checkedAt: Date.now(),
      });
      return probeEntry.version;
    }

    const fetched = await fetchFromNetwork(probeUrl, this.token, fetchImpl);
    await this.store.writeEntry(probeUrl, buildCacheEntry(probeUrl, fetched));

    if (fetched.version === undefined) {
      return undefined;
    }

    await this.store.writeFileVersion(fileKey, {
      version: fetched.version,
      lastModified: fetched.lastModified,
      checkedAt: Date.now(),
    });

    return fetched.version;
  }
}
