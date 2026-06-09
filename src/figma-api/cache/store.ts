import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CACHE_DIR_NAME } from "./constants.js";
import type { CacheEntry, FileVersionEntry } from "./types.js";
import { hashValue, normalizeRequestUrl } from "./url.js";

function getCacheRoot(token: string): string {
  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex")
    .slice(0, 16);
  return join(tmpdir(), CACHE_DIR_NAME, tokenHash);
}

function entryPath(cacheRoot: string, url: string): string {
  return join(
    cacheRoot,
    "entries",
    `${hashValue(normalizeRequestUrl(url))}.json`,
  );
}

function fileVersionPath(cacheRoot: string, fileKey: string): string {
  return join(cacheRoot, "files", `${hashValue(fileKey)}.json`);
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  const tempPath = `${path}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value)}\n`, "utf8");
  await rename(tempPath, path);
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export class FigmaCacheStore {
  private readonly cacheRoot: string;

  constructor(token: string) {
    this.cacheRoot = getCacheRoot(token);
  }

  readEntry(url: string): Promise<CacheEntry | undefined> {
    return readJsonFile<CacheEntry>(entryPath(this.cacheRoot, url));
  }

  writeEntry(url: string, entry: CacheEntry): Promise<void> {
    return writeJsonAtomic(entryPath(this.cacheRoot, url), entry);
  }

  readFileVersion(fileKey: string): Promise<FileVersionEntry | undefined> {
    return readJsonFile<FileVersionEntry>(
      fileVersionPath(this.cacheRoot, fileKey),
    );
  }

  writeFileVersion(fileKey: string, entry: FileVersionEntry): Promise<void> {
    return writeJsonAtomic(fileVersionPath(this.cacheRoot, fileKey), entry);
  }
}
