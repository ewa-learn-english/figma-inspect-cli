async function readErrorBody(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload: unknown = await response.json().catch(() => undefined);
    if (!payload || typeof payload !== "object") {
      return "";
    }

    const record = payload as Record<string, unknown>;
    if (typeof record.message === "string") {
      return record.message;
    }
    if (typeof record.err === "string") {
      return record.err;
    }

    return JSON.stringify(payload);
  }

  return response.text().catch(() => "");
}

export async function formatFigmaError(response: Response): Promise<string> {
  const body = await readErrorBody(response);
  const detail = body ? `: ${body}` : "";
  return `Figma API request failed (${response.status} ${response.statusText})${detail}`;
}
