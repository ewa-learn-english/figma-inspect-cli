const MAX_RATE_LIMIT_RETRIES = 10;
const MIN_RETRY_DELAY_MS = 1000;
const RATE_LIMIT_BUFFER_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function discardResponseBody(response: Response): Promise<void> {
  await response.arrayBuffer().catch(() => undefined);
}

function rateLimitDelayMs(response: Response, now = Date.now()): number {
  const resetHeader = response.headers.get("x-ratelimit-reset");
  if (resetHeader) {
    const resetAtMs = Number.parseInt(resetHeader, 10) * 1000;
    if (Number.isFinite(resetAtMs)) {
      return Math.max(
        MIN_RETRY_DELAY_MS,
        resetAtMs - now + RATE_LIMIT_BUFFER_MS,
      );
    }
  }

  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const retryAfterSeconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(retryAfterSeconds)) {
      return Math.max(MIN_RETRY_DELAY_MS, retryAfterSeconds * 1000);
    }
  }

  return MIN_RETRY_DELAY_MS;
}

export async function fetchFigmaResponse(
  url: string | URL,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: {
        "X-FIGMA-TOKEN": token,
      },
    });

    if (response.status !== 429) {
      return response;
    }

    if (attempt === MAX_RATE_LIMIT_RETRIES) {
      return response;
    }

    const delayMs = rateLimitDelayMs(response);
    await discardResponseBody(response);
    await sleep(delayMs);
  }

  throw new Error("Unreachable fetch retry loop.");
}
