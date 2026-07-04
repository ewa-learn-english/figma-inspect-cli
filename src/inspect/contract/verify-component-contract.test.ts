import { cp, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contractFixturesDir } from "../../test/fixtures.js";
import { FigmaInspectError } from "../errors.js";
import type { DocumentNode } from "../schemas.js";
import { serializeContractData } from "./contract-format.js";
import type { ContractLock } from "./contract-lock.js";
import {
  buildContractLock,
  readContractLock,
  resolveContractLockPath,
} from "./contract-lock.js";
import { fingerprintContractSurface, fingerprintTree } from "./fingerprint.js";
import {
  verifyComponentContracts,
  verifyComponentLock,
} from "./verify-component-contract.js";

const contractFixtures = contractFixturesDir;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function profileStreakComponentSetTree(): DocumentNode {
  return {
    id: "5708:145",
    type: "COMPONENT_SET",
    name: "ProfileStreakIcon",
    isExposedInstance: false,
    componentPropertyDefinitions: {
      Status: {
        type: "VARIANT",
        defaultValue: "Missed",
        variantOptions: ["Active", "Missed", "Loading"],
      },
      Size: {
        type: "VARIANT",
        defaultValue: "M",
        variantOptions: ["M", "XL"],
      },
    },
    children: [
      {
        type: "COMPONENT",
        id: "5708:146",
        name: "Status=Active, Size=M",
        isExposedInstance: false,
        children: [{ type: "RECTANGLE", isExposedInstance: false }],
      },
      {
        type: "COMPONENT",
        id: "5708:250",
        name: "Status=Missed, Size=M",
        isExposedInstance: false,
        children: [{ type: "RECTANGLE", isExposedInstance: false }],
      },
      {
        type: "COMPONENT",
        id: "5708:261",
        name: "Status=Loading, Size=M",
        isExposedInstance: false,
        children: [{ type: "RECTANGLE", isExposedInstance: false }],
      },
      {
        type: "COMPONENT",
        id: "9775:961",
        name: "Status=Active, Size=XL",
        isExposedInstance: false,
        children: [{ type: "RECTANGLE", isExposedInstance: false }],
      },
      {
        type: "COMPONENT",
        id: "9775:952",
        name: "Status=Missed, Size=XL",
        isExposedInstance: false,
        children: [{ type: "RECTANGLE", isExposedInstance: false }],
      },
      {
        type: "COMPONENT",
        id: "9775:973",
        name: "Status=Loading, Size=XL",
        isExposedInstance: false,
        children: [{ type: "RECTANGLE", isExposedInstance: false }],
      },
    ],
  };
}

function buildLiveMockResponses(
  lock: NonNullable<Awaited<ReturnType<typeof readContractLock>>>,
  tree: DocumentNode,
  sourceOverrides?: Partial<(typeof lock)["source"]>,
) {
  const source = { ...lock.source, ...sourceOverrides };

  return {
    componentSet: {
      meta: {
        key: source.componentSetKey,
        file_key: source.fileKey,
        node_id: source.nodeId,
        name: "ProfileStreakIcon",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    },
    fileComponents: {
      meta: {
        components: lock.variants.map((variant) => ({
          key: variant.key,
          file_key: source.fileKey,
          node_id: variant.nodeId,
          name: variant.name,
          updated_at: "2026-01-01T00:00:00.000Z",
          containing_frame: {
            containingComponentSet: { nodeId: source.nodeId },
          },
        })),
      },
    },
    fileNode: {
      nodes: {
        [source.nodeId]: {
          document: {
            id: "page",
            type: "CANVAS",
            isExposedInstance: false,
            children: [tree],
          },
          componentSets: {
            [source.nodeId]: {
              key: source.componentSetKey,
              name: "ProfileStreakIcon",
            },
          },
          components: {},
        },
      },
    },
  };
}

function createFigmaFetchMock(responses: {
  componentSet?: unknown;
  fileComponents?: unknown;
  fileNode?: unknown;
}): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/component_sets/")) {
      return jsonResponse(responses.componentSet ?? { meta: {} });
    }
    if (url.includes("/components")) {
      return jsonResponse(
        responses.fileComponents ?? { meta: { components: [] } },
      );
    }
    if (url.includes("/nodes")) {
      return jsonResponse(responses.fileNode ?? { nodes: {} });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;
}

async function copyProfileStreakContracts(targetDir: string): Promise<void> {
  const files = [
    "ProfileStreakIcon.component-set.meta.yaml",
    "ProfileStreakIcon.component-set.geometry.yaml",
    "ProfileStreakIcon.component-set.visuals.yaml",
    "ProfileStreakIcon.component-set.structure.dsl",
  ];

  await Promise.all(
    files.map((fileName) =>
      cp(path.join(contractFixtures, fileName), path.join(targetDir, fileName)),
    ),
  );
}

async function loadProfileStreakLock(
  contractDir = contractFixtures,
): Promise<ContractLock> {
  const lock = await readContractLock(
    resolveContractLockPath(contractDir, "ProfileStreakIcon"),
  );
  if (!lock) {
    throw new Error("ProfileStreakIcon lock fixture is missing.");
  }

  return lock;
}

describe("verifyComponentContracts", () => {
  beforeEach(() => {
    vi.stubEnv("FIGMA_CACHE", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when the contract directory has no lock files", async () => {
    const emptyDir = await mkdtemp(path.join(tmpdir(), "figma-verify-empty-"));

    await expect(
      verifyComponentContracts({
        token: "token",
        contractDir: emptyDir,
      }),
    ).rejects.toThrow(FigmaInspectError);
    await expect(
      verifyComponentContracts({
        token: "token",
        contractDir: emptyDir,
      }),
    ).rejects.toThrow(/No \*\.component-set\.lock\.yaml files found/);
  });

  it("returns error when a named component lock file is missing", async () => {
    const results = await verifyComponentContracts({
      token: "token",
      contractDir: contractFixtures,
      componentName: "MissingComponent",
      fetchImpl: createFigmaFetchMock({}),
    });

    expect(results).toEqual([
      {
        componentName: "MissingComponent",
        status: "error",
        errors: [
          `Missing lock file: ${resolveContractLockPath(contractFixtures, "MissingComponent")}`,
        ],
        changed: {
          source: false,
          tree: false,
          contractSurface: false,
          variants: [],
          addedVariants: [],
          removedVariants: [],
        },
      },
    ]);
  });

  it("reports ok when live Figma data matches the lock", async () => {
    const contractDir = await mkdtemp(path.join(tmpdir(), "figma-verify-ok-"));
    await copyProfileStreakContracts(contractDir);

    const sourceLock = await loadProfileStreakLock();

    const tree = profileStreakComponentSetTree();
    const lock = buildContractLock({
      source: sourceLock.source,
      variants: sourceLock.variants,
      fingerprints: {
        tree: fingerprintTree(tree),
        contractSurface: fingerprintContractSurface(tree),
        contracts: sourceLock.fingerprints.contracts,
        assets: sourceLock.fingerprints.assets,
      },
    });

    await writeFile(
      resolveContractLockPath(contractDir, "ProfileStreakIcon"),
      serializeContractData(lock, "yaml"),
    );

    const liveResponses = buildLiveMockResponses(sourceLock, tree);
    const results = await verifyComponentContracts({
      token: "token",
      contractDir,
      componentName: "ProfileStreakIcon",
      fetchImpl: createFigmaFetchMock(liveResponses),
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("ok");
    expect(results[0]?.errors).toEqual([]);
    expect(results[0]?.changed).toEqual({
      source: false,
      tree: false,
      contractSurface: false,
      variants: [],
      addedVariants: [],
      removedVariants: [],
    });
  });

  it("reports ok when only live Figma updated_at metadata changes", async () => {
    const contractDir = await mkdtemp(
      path.join(tmpdir(), "figma-verify-meta-"),
    );
    await copyProfileStreakContracts(contractDir);

    const sourceLock = await loadProfileStreakLock();
    const tree = profileStreakComponentSetTree();
    const lock = buildContractLock({
      source: sourceLock.source,
      variants: sourceLock.variants,
      fingerprints: {
        tree: fingerprintTree(tree),
        contractSurface: fingerprintContractSurface(tree),
        contracts: sourceLock.fingerprints.contracts,
        assets: sourceLock.fingerprints.assets,
      },
    });

    await writeFile(
      resolveContractLockPath(contractDir, "ProfileStreakIcon"),
      serializeContractData(lock, "yaml"),
    );

    const liveResponses = buildLiveMockResponses(lock, tree);
    liveResponses.componentSet.meta.updated_at = "2099-01-01T00:00:00.000Z";
    liveResponses.fileComponents.meta.components =
      liveResponses.fileComponents.meta.components.map((component) => ({
        ...component,
        updated_at: "2099-01-01T00:00:00.000Z",
      }));

    const results = await verifyComponentContracts({
      token: "token",
      contractDir,
      componentName: "ProfileStreakIcon",
      fetchImpl: createFigmaFetchMock(liveResponses),
    });

    expect(results[0]?.status).toBe("ok");
    expect(results[0]?.changed.source).toBe(false);
    expect(results[0]?.changed.variants).toEqual([]);
    expect(results[0]?.errors).toEqual([]);
  });

  it("reports ok when only absolute canvas position changes", async () => {
    const contractDir = await mkdtemp(
      path.join(tmpdir(), "figma-verify-surface-"),
    );
    await copyProfileStreakContracts(contractDir);

    const sourceLock = await loadProfileStreakLock();
    const tree = {
      ...profileStreakComponentSetTree(),
      absoluteBoundingBox: { x: 10, y: 20, width: 100, height: 100 },
    };
    const movedTree = {
      ...tree,
      absoluteBoundingBox: { x: 900, y: 1200, width: 100, height: 100 },
    };
    const lock = buildContractLock({
      source: sourceLock.source,
      variants: sourceLock.variants,
      fingerprints: {
        tree: fingerprintTree(tree),
        contractSurface: fingerprintContractSurface(tree),
        contracts: sourceLock.fingerprints.contracts,
        assets: sourceLock.fingerprints.assets,
      },
    });

    await writeFile(
      resolveContractLockPath(contractDir, "ProfileStreakIcon"),
      serializeContractData(lock, "yaml"),
    );

    const results = await verifyComponentContracts({
      token: "token",
      contractDir,
      componentName: "ProfileStreakIcon",
      fetchImpl: createFigmaFetchMock(buildLiveMockResponses(lock, movedTree)),
    });

    expect(fingerprintTree(movedTree)).not.toBe(fingerprintTree(tree));
    expect(fingerprintContractSurface(movedTree)).toBe(
      fingerprintContractSurface(tree),
    );
    expect(results[0]?.status).toBe("ok");
    expect(results[0]?.changed).toEqual({
      source: false,
      tree: false,
      contractSurface: false,
      variants: [],
      addedVariants: [],
      removedVariants: [],
    });
  });

  it("discovers and verifies every lock file in the contract directory", async () => {
    const lock = await loadProfileStreakLock();

    const tree = profileStreakComponentSetTree();
    const liveResponses = buildLiveMockResponses(lock, tree);
    const fetchImpl = createFigmaFetchMock(liveResponses);

    const results = await verifyComponentContracts({
      token: "token",
      contractDir: contractFixtures,
      fetchImpl,
    });

    const names = results.map((result) => result.componentName);
    expect(names).toContain("ProfileStreakIcon");
    expect(names).toContain("TextInput");
    expect(names).toContain("Cell");
    expect(
      results.find((result) => result.componentName === "ProfileStreakIcon")
        ?.status,
    ).toBe("changed");
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("returns error when live Figma API requests fail", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: "Forbidden" }, 403),
    ) as typeof fetch;

    const results = await verifyComponentContracts({
      token: "token",
      contractDir: contractFixtures,
      componentName: "ProfileStreakIcon",
      fetchImpl,
    });

    expect(results[0]?.status).toBe("error");
    expect(results[0]?.errors[0]).toMatch(/403.*Forbidden/);
  });

  it("returns error when the node entry has no component sets", async () => {
    const lock = await loadProfileStreakLock();

    const results = await verifyComponentContracts({
      token: "token",
      contractDir: contractFixtures,
      componentName: "ProfileStreakIcon",
      fetchImpl: createFigmaFetchMock({
        componentSet: buildLiveMockResponses(
          lock,
          profileStreakComponentSetTree(),
        ).componentSet,
        fileComponents: buildLiveMockResponses(
          lock,
          profileStreakComponentSetTree(),
        ).fileComponents,
        fileNode: {
          nodes: {
            [lock.source.nodeId]: {
              document: {
                id: "page",
                type: "CANVAS",
                isExposedInstance: false,
                children: [],
              },
              componentSets: {},
              components: {},
            },
          },
        },
      }),
    });

    expect(results[0]?.status).toBe("error");
    expect(results[0]?.errors[0]).toMatch(/No component sets found/);
  });

  it("returns error when contract artifacts fail validation", async () => {
    const contractDir = await mkdtemp(
      path.join(tmpdir(), "figma-verify-invalid-"),
    );
    await copyProfileStreakContracts(contractDir);
    await cp(
      resolveContractLockPath(contractFixtures, "ProfileStreakIcon"),
      resolveContractLockPath(contractDir, "ProfileStreakIcon"),
    );
    await writeFile(
      path.join(contractDir, "ProfileStreakIcon.component-set.structure.dsl"),
      "component WrongName\ncontracts {}\n",
    );

    const lock = await loadProfileStreakLock(contractDir);

    const results = await verifyComponentContracts({
      token: "token",
      contractDir,
      componentName: "ProfileStreakIcon",
      fetchImpl: createFigmaFetchMock(
        buildLiveMockResponses(lock, profileStreakComponentSetTree()),
      ),
    });

    expect(results[0]?.status).toBe("error");
    expect(results[0]?.errors[0]).toMatch(/structure DSL/);
  });

  it("verifies a single component lock without contract artifacts", async () => {
    const contractDir = await mkdtemp(path.join(tmpdir(), "figma-lock-only-"));
    const sourceLock = await loadProfileStreakLock();
    const tree = profileStreakComponentSetTree();
    const lock = buildContractLock({
      source: sourceLock.source,
      variants: sourceLock.variants,
      fingerprints: {
        tree: fingerprintTree(tree),
        contractSurface: fingerprintContractSurface(tree),
        contracts: sourceLock.fingerprints.contracts,
        assets: sourceLock.fingerprints.assets,
      },
    });
    const lockPath = resolveContractLockPath(contractDir, "ProfileStreakIcon");
    await writeFile(lockPath, serializeContractData(lock, "yaml"));

    const result = await verifyComponentLock({
      token: "token",
      lockPath,
      fetchImpl: createFigmaFetchMock(buildLiveMockResponses(lock, tree)),
    });

    expect(result).toEqual({
      componentName: "ProfileStreakIcon",
      status: "ok",
      errors: [],
      changed: {
        source: false,
        tree: false,
        contractSurface: false,
        variants: [],
        addedVariants: [],
        removedVariants: [],
      },
    });
  });
});
