import { FigmaResponseTooLargeError } from "../figma-api/figma-api-error.js";
import { getFile, getFileNodes } from "../figma-api/get-file.js";
import { isRecord, readRecord } from "./component-set-spec/figma-node.js";
import { FigmaInspectError } from "./errors.js";
import { type FileNodeEntry, parseComponentMaps } from "./schemas.js";
import { slimIndexNode } from "./team-index.js";

// Larger responses are split so one parsed response stays far below Node's
// default heap; any file under this size still downloads in one request.
const INDEX_RESPONSE_MAX_BYTES = 128 * 1024 * 1024;

interface TeamIndexSourceOptions {
  token: string;
  fileKey: string;
  fetchImpl?: typeof fetch;
}

function indexEntry(payload: unknown): FileNodeEntry {
  return {
    document: isRecord(payload) ? slimIndexNode(payload.document) : undefined,
    ...parseComponentMaps(payload),
  };
}

function nodeEntries(
  payload: unknown,
  nodeIds: readonly string[],
): Map<string, FileNodeEntry> {
  const nodes = isRecord(payload) ? readRecord(payload, "nodes") : undefined;
  if (!nodes) {
    throw new FigmaInspectError("Invalid Figma file nodes response.");
  }

  return new Map(
    nodeIds.map((nodeId) => {
      if (!nodes[nodeId]) {
        // The node was deleted after its parent was read; a later refresh
        // sees the file's new modification time and retries it.
        throw new FigmaInspectError(
          `Figma node ${nodeId} disappeared while the file was downloaded.`,
        );
      }
      return [nodeId, indexEntry(nodes[nodeId])] as const;
    }),
  );
}

function childIds(entry: FileNodeEntry | undefined): string[] {
  return (entry?.document?.children ?? []).flatMap((child) =>
    typeof child.id === "string" ? [child.id] : [],
  );
}

// Children of an oversized node are about as large together, so start halved.
async function fetchHalves(
  nodeIds: readonly string[],
  options: TeamIndexSourceOptions,
): Promise<Map<string, FileNodeEntry>> {
  const middle = Math.ceil(nodeIds.length / 2);
  return new Map([
    ...(await fetchNodeEntries(nodeIds.slice(0, middle), options)),
    ...(await fetchNodeEntries(nodeIds.slice(middle), options)),
  ]);
}

async function withFetchedChildren(
  shallow: FileNodeEntry,
  options: TeamIndexSourceOptions,
): Promise<FileNodeEntry> {
  const ids = childIds(shallow);
  const children = await fetchHalves(ids, options);
  const entries = [shallow, ...children.values()];
  return {
    document: shallow.document && {
      ...shallow.document,
      children: ids.flatMap((id) => children.get(id)?.document ?? []),
    },
    componentSets: Object.assign(
      {},
      ...entries.map((entry) => entry.componentSets),
    ),
    components: Object.assign({}, ...entries.map((entry) => entry.components)),
  };
}

async function fetchNodeEntries(
  nodeIds: readonly string[],
  options: TeamIndexSourceOptions,
): Promise<Map<string, FileNodeEntry>> {
  if (nodeIds.length === 0) {
    return new Map();
  }

  try {
    return nodeEntries(
      await getFileNodes({
        ...options,
        nodeIds,
        maxBytes: INDEX_RESPONSE_MAX_BYTES,
      }),
      nodeIds,
    );
  } catch (error) {
    if (!(error instanceof FigmaResponseTooLargeError)) {
      throw error;
    }
  }

  if (nodeIds.length > 1) {
    return fetchHalves(nodeIds, options);
  }

  const [nodeId] = nodeIds;
  const shallow = nodeEntries(
    await getFileNodes({ ...options, nodeIds, depth: 1 }),
    nodeIds,
  ).get(nodeId);
  if (!shallow || childIds(shallow).length === 0) {
    throw new FigmaResponseTooLargeError(
      `Figma node ${nodeId} in file ${options.fileKey} is too large to download and has no children to split.`,
    );
  }

  return new Map([[nodeId, await withFetchedChildren(shallow, options)]]);
}

/**
 * Downloads a file for the team index. A file over the response budget, or one
 * Figma refuses as too large, is requested page by page and then in batches of
 * child nodes.
 */
export async function fetchTeamIndexEntry(
  options: TeamIndexSourceOptions,
): Promise<FileNodeEntry> {
  try {
    return indexEntry(
      await getFile({ ...options, maxBytes: INDEX_RESPONSE_MAX_BYTES }),
    );
  } catch (error) {
    if (!(error instanceof FigmaResponseTooLargeError)) {
      throw error;
    }
  }

  return withFetchedChildren(
    indexEntry(await getFile({ ...options, depth: 1 })),
    options,
  );
}
