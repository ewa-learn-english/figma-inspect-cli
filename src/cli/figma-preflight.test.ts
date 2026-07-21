import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runFigmaPreflight } from "./figma-preflight.js";

let indexRoot: string | undefined;

afterEach(async () => {
  if (indexRoot) {
    await rm(indexRoot, { recursive: true, force: true });
    indexRoot = undefined;
  }
});

describe("runFigmaPreflight", () => {
  it("reports team access failures and temporary API failures", async () => {
    indexRoot = await mkdtemp(path.join(os.tmpdir(), "figma-preflight-"));
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const teamId = String(input).match(/teams\/([^/]+)\/projects/)?.[1];
      const status =
        teamId === "allowed" ? 200 : teamId === "denied" ? 403 : 503;
      return new Response("", { status });
    });

    const result = await runFigmaPreflight({
      token: "secret-token",
      teams: [
        { alias: "design", id: "allowed" },
        { alias: "private", id: "denied" },
        { alias: "outage", id: "offline" },
      ],
      indexRoot,
      cliVersion: "1.2.3",
      now: new Date("2026-07-21T00:00:00.000Z"),
      fetchImpl,
    });

    expect(result).toMatchObject({
      status: "failed",
      checkedAt: "2026-07-21T00:00:00.000Z",
      cliVersion: "1.2.3",
      teams: [
        { alias: "design", id: "allowed", status: "passed" },
        { alias: "private", id: "denied", status: "failed" },
        { alias: "outage", id: "offline", status: "unavailable" },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });
});
