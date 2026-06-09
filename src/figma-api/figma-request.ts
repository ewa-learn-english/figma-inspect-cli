import { FigmaApiError } from "./figma-api-error.js";
import { formatFigmaError } from "./format-figma-error.js";

export async function figmaRequest(
  url: string | URL,
  token: string,
  fetchImpl: typeof fetch = fetch,
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
