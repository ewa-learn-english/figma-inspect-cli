import { FIGMA_API_BASE_URL } from "./constants.js";
import { figmaRequest } from "./figma-request.js";
import {
  type FigmaPublishedComponentSet,
  parseTeamComponentSetsResponse,
} from "./schemas.js";
import type { ListTeamComponentSetsOptions } from "./types.js";

export async function listTeamComponentSets({
  token,
  teamId,
  fetchImpl = fetch,
}: ListTeamComponentSetsOptions): Promise<FigmaPublishedComponentSet[]> {
  const componentSets: FigmaPublishedComponentSet[] = [];
  let after: string | undefined;

  do {
    const url = new URL(
      `${FIGMA_API_BASE_URL}/teams/${encodeURIComponent(teamId)}/component_sets`,
    );
    if (after) {
      url.searchParams.set("after", after);
    }

    const payload = await figmaRequest(url, token, fetchImpl);
    const page = parseTeamComponentSetsResponse(payload);
    componentSets.push(...page.componentSets);
    after = page.cursorAfter;
  } while (after);

  return componentSets;
}
