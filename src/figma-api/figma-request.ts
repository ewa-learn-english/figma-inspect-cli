import { CACHE_DISABLED_ENV, CachedFigmaRequest } from "./cache/index.js";
import { FigmaApiError } from "./figma-api-error.js";
import { formatFigmaError } from "./format-figma-error.js";

function isCacheEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[CACHE_DISABLED_ENV] !== "0";
}

async function fetchWithoutCache(
  url: string | URL,
  token: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: {
      "X-FIGMA-TOKEN": token,
    },
  });

  if (!response.ok) {
    throw new FigmaApiError(await formatFigmaError(response));
  }

  return response.json();
}

export async function figmaRequest(
  url: string | URL,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  if (!isCacheEnabled()) {
    return fetchWithoutCache(url, token, fetchImpl);
  }

  return new CachedFigmaRequest(token).request(url, fetchImpl);
}
