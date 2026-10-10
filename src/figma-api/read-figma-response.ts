import { constants } from "node:buffer";
import {
  FigmaApiError,
  FigmaResponseTooLargeError,
  FigmaUnreadableFileError,
} from "./figma-api-error.js";
import { formatFigmaError } from "./format-figma-error.js";

const FIGMA_TOO_LARGE_MESSAGE = "Request too large";
const UNREADABLE_FILE_MESSAGES = new Map([
  [400, "File type not supported"],
  [403, "File not exportable"],
]);
// 413 and 414 also reject a request by its size, such as a long node id list.
const TOO_LARGE_STATUSES = new Set([413, 414]);

async function readJsonBody(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  if (response.body === null) {
    return response.json();
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) {
      throw new FigmaResponseTooLargeError(
        `Figma response exceeds ${maxBytes} bytes; request a smaller node.`,
      );
    }
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks, size);
  chunks.length = 0; // Free the chunks before decoding a large body.
  return JSON.parse(body.toString("utf8"));
}

/**
 * Parses a Figma response, streaming the body so one too large to parse fails
 * clearly. By default that is Node's string limit; a body never has fewer bytes
 * than characters.
 */
export async function readFigmaResponse(
  response: Response,
  maxBytes: number = constants.MAX_STRING_LENGTH,
): Promise<unknown> {
  if (response.ok) {
    return readJsonBody(response, maxBytes);
  }

  const message = await formatFigmaError(response);
  const tooLarge =
    TOO_LARGE_STATUSES.has(response.status) ||
    (response.status === 400 && message.includes(FIGMA_TOO_LARGE_MESSAGE));
  if (tooLarge) {
    throw new FigmaResponseTooLargeError(message);
  }
  const unreadable = UNREADABLE_FILE_MESSAGES.get(response.status);
  throw unreadable !== undefined && message.includes(unreadable)
    ? new FigmaUnreadableFileError(message)
    : new FigmaApiError(message);
}
