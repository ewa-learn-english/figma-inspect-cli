import { FIGMA_API_BASE_URL } from "./constants.js";
import { FigmaApiError } from "./figma-api-error.js";
import { formatFigmaError } from "./format-figma-error.js";
import type { FigmaPage, ListFilePagesOptions } from "./types.js";

interface FileNode {
  id?: string;
  name?: string;
  type?: string;
  children?: FileNode[];
}

interface FileResponse {
  document?: FileNode;
}

export async function listFilePages({
  token,
  fileKey,
  fetchImpl = fetch,
}: ListFilePagesOptions): Promise<FigmaPage[]> {
  const url = new URL(
    `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}`,
  );
  url.searchParams.set("depth", "1");

  const response = await fetchImpl(url, {
    headers: {
      "X-FIGMA-TOKEN": token,
    },
  });

  if (!response.ok) {
    throw new FigmaApiError(await formatFigmaError(response));
  }

  const payload = (await response.json()) as FileResponse;
  const children = payload.document?.children;
  if (!Array.isArray(children)) {
    return [];
  }

  return children
    .filter((node) => node.type === "CANVAS")
    .map((page) => ({
      id: String(page.id ?? ""),
      name: String(page.name ?? ""),
    }));
}
