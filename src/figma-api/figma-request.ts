import { CACHE_DISABLED_ENV, CachedFigmaRequest } from "./cache/index.js";
import { fetchFigmaResponse } from "./fetch-with-retry.js";
import { readFigmaResponse } from "./read-figma-response.js";

function isCacheEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[CACHE_DISABLED_ENV] !== "0";
}

export async function figmaRequest(
  url: string | URL,
  token: string,
  fetchImpl: typeof fetch = fetch,
  options: { cache?: boolean; maxBytes?: number } = {},
): Promise<unknown> {
  if (options.cache === false || !isCacheEnabled()) {
    return readFigmaResponse(
      await fetchFigmaResponse(url, token, fetchImpl),
      options.maxBytes,
    );
  }

  return new CachedFigmaRequest(token).request(url, fetchImpl);
}
