import {
  readNumber,
  readRecord,
  readString,
} from "./component-set-spec/figma-node.js";
import type { DocumentNode } from "./schemas.js";

type LayoutRiskSeverity = "low" | "medium" | "high";

export interface LayoutContext {
  path: string;
  id?: string;
  name: string;
  type: string;
  layoutMode?: string;
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  layoutAlign?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  maxWidth?: number;
  minWidth?: number;
  maxHeight?: number;
  minHeight?: number;
}

export interface LayoutRisk {
  type:
    | "constrained-fill"
    | "constrained-stretch"
    | "centered-parent-constrained-fill"
    | "wide-breakpoint-sensitive"
    | "sibling-width-mismatch";
  severity: LayoutRiskSeverity;
  nodePath: string;
  message: string;
  evidence: Record<string, unknown>;
}

interface LayoutRisksForUsageOptions {
  node: DocumentNode;
  path: string;
  ancestorChain: LayoutContext[];
  parentNode?: DocumentNode;
  screenSizes: readonly string[];
}

function nodeName(node: DocumentNode): string {
  return readString(node, "name") ?? "Untitled";
}

function nodeType(node: DocumentNode): string {
  return readString(node, "type") ?? "UNKNOWN";
}

function nodeId(node: DocumentNode): string | undefined {
  return readString(node, "id");
}

export function layoutContext(node: DocumentNode, path: string): LayoutContext {
  return {
    path,
    ...(nodeId(node) ? { id: nodeId(node) } : {}),
    name: nodeName(node),
    type: nodeType(node),
    ...(readString(node, "layoutMode")
      ? { layoutMode: readString(node, "layoutMode") }
      : {}),
    ...(readString(node, "layoutSizingHorizontal")
      ? { layoutSizingHorizontal: readString(node, "layoutSizingHorizontal") }
      : {}),
    ...(readString(node, "layoutSizingVertical")
      ? { layoutSizingVertical: readString(node, "layoutSizingVertical") }
      : {}),
    ...(readString(node, "layoutAlign")
      ? { layoutAlign: readString(node, "layoutAlign") }
      : {}),
    ...(readString(node, "primaryAxisSizingMode")
      ? { primaryAxisSizingMode: readString(node, "primaryAxisSizingMode") }
      : {}),
    ...(readString(node, "counterAxisSizingMode")
      ? { counterAxisSizingMode: readString(node, "counterAxisSizingMode") }
      : {}),
    ...(readString(node, "primaryAxisAlignItems")
      ? { primaryAxisAlignItems: readString(node, "primaryAxisAlignItems") }
      : {}),
    ...(readString(node, "counterAxisAlignItems")
      ? { counterAxisAlignItems: readString(node, "counterAxisAlignItems") }
      : {}),
    ...(readNumber(node, "maxWidth") !== undefined
      ? { maxWidth: readNumber(node, "maxWidth") }
      : {}),
    ...(readNumber(node, "minWidth") !== undefined
      ? { minWidth: readNumber(node, "minWidth") }
      : {}),
    ...(readNumber(node, "maxHeight") !== undefined
      ? { maxHeight: readNumber(node, "maxHeight") }
      : {}),
    ...(readNumber(node, "minHeight") !== undefined
      ? { minHeight: readNumber(node, "minHeight") }
      : {}),
  };
}

function pathSegment(raw: string | undefined, fallback: string): string {
  const words = (raw ?? fallback)
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return fallback;
  }

  return words
    .map((word, index) => {
      const lower = word.charAt(0).toLowerCase() + word.slice(1);
      return index === 0
        ? lower
        : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function childPath(
  parentPath: string,
  child: DocumentNode,
  index: number,
  siblingCounts: Map<string, number>,
): string {
  const segment = pathSegment(readString(child, "name"), `child${index + 1}`);
  const nextCount = (siblingCounts.get(segment) ?? 0) + 1;
  siblingCounts.set(segment, nextCount);
  const uniqueSegment = nextCount === 1 ? segment : `${segment}${nextCount}`;
  return parentPath === "root"
    ? uniqueSegment
    : `${parentPath}.${uniqueSegment}`;
}

function hasHorizontalFill(node: DocumentNode): boolean {
  return readString(node, "layoutSizingHorizontal") === "FILL";
}

function hasStretchAlign(node: DocumentNode): boolean {
  return readString(node, "layoutAlign") === "STRETCH";
}

function maxWidth(node: DocumentNode): number | undefined {
  return readNumber(node, "maxWidth");
}

function parentCentersCrossAxis(parent: LayoutContext | undefined): boolean {
  return parent?.counterAxisAlignItems === "CENTER";
}

function screenWidth(size: string): number | undefined {
  const [rawWidth] = size.split("x");
  const width = Number(rawWidth);
  return Number.isFinite(width) ? width : undefined;
}

function wideBreakpointEvidence(
  screenSizes: readonly string[],
  limit: number,
): { affected: string[]; safe: string[] } {
  const affected: string[] = [];
  const safe: string[] = [];

  for (const size of screenSizes) {
    const width = screenWidth(size);
    if (width === undefined) {
      continue;
    }
    if (width > limit) {
      affected.push(size);
    } else {
      safe.push(size);
    }
  }

  return { affected, safe };
}

function addRisk(
  risks: LayoutRisk[],
  risk: LayoutRisk,
  seen: Set<string>,
): void {
  const key = `${risk.type}:${risk.nodePath}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  risks.push(risk);
}

function visitRiskNode(
  node: DocumentNode,
  path: string,
  ancestors: LayoutContext[],
  screenSizes: readonly string[],
  risks: LayoutRisk[],
  seen: Set<string>,
): void {
  const limit = maxWidth(node);
  const horizontalFill = hasHorizontalFill(node);
  const stretch = hasStretchAlign(node);
  const parent = ancestors.at(-1);

  if (limit !== undefined && horizontalFill) {
    addRisk(
      risks,
      {
        type: "constrained-fill",
        severity: "medium",
        nodePath: path,
        message:
          "Node fills horizontally but is capped by maxWidth; verify the capped box, not only text alignment.",
        evidence: {
          layoutSizingHorizontal: "FILL",
          maxWidth: limit,
        },
      },
      seen,
    );
  }

  if (limit !== undefined && stretch) {
    addRisk(
      risks,
      {
        type: "constrained-stretch",
        severity: "medium",
        nodePath: path,
        message:
          "Node stretches to its parent and is capped by maxWidth; React Native Web may clamp without centering.",
        evidence: {
          layoutAlign: "STRETCH",
          maxWidth: limit,
        },
      },
      seen,
    );
  }

  if (
    limit !== undefined &&
    (horizontalFill || stretch) &&
    parentCentersCrossAxis(parent)
  ) {
    addRisk(
      risks,
      {
        type: "centered-parent-constrained-fill",
        severity: "high",
        nodePath: path,
        message:
          "Constrained fill lives under a centered cross-axis parent; use a centered wrapper or explicit centered capped width.",
        evidence: {
          layoutSizingHorizontal: readString(node, "layoutSizingHorizontal"),
          layoutAlign: readString(node, "layoutAlign"),
          maxWidth: limit,
          parentPath: parent?.path,
          parentCounterAxisAlignItems: parent?.counterAxisAlignItems,
        },
      },
      seen,
    );
  }

  if (limit !== undefined) {
    const { affected, safe } = wideBreakpointEvidence(screenSizes, limit);
    if (affected.length > 0) {
      addRisk(
        risks,
        {
          type: "wide-breakpoint-sensitive",
          severity: safe.length > 0 ? "high" : "medium",
          nodePath: path,
          message:
            "The maxWidth constraint is active on wider screens and may be invisible on phone-sized checks.",
          evidence: {
            maxWidth: limit,
            affectedScreenSizes: affected,
            safeScreenSizes: safe,
          },
        },
        seen,
      );
    }
  }

  const childAncestors = [...ancestors, layoutContext(node, path)].slice(-5);
  const siblingCounts = new Map<string, number>();
  for (const [index, child] of (node.children ?? []).entries()) {
    visitRiskNode(
      child,
      childPath(path, child, index, siblingCounts),
      childAncestors,
      screenSizes,
      risks,
      seen,
    );
  }
}

function hasDescendantMaxWidth(node: DocumentNode): boolean {
  return (node.children ?? []).some(
    (child) => maxWidth(child) !== undefined || hasDescendantMaxWidth(child),
  );
}

function siblingNamesWithRootMaxWidth(
  parentNode: DocumentNode | undefined,
  currentNodeId: string | undefined,
): string[] {
  if (!parentNode) {
    return [];
  }

  return (parentNode.children ?? [])
    .filter((child) => readString(child, "id") !== currentNodeId)
    .filter((child) => maxWidth(child) !== undefined)
    .map((child) => readString(child, "name") ?? readString(child, "id"))
    .filter((name): name is string => Boolean(name));
}

export function layoutRisksForUsage({
  node,
  path,
  ancestorChain,
  parentNode,
  screenSizes,
}: LayoutRisksForUsageOptions): LayoutRisk[] {
  const risks: LayoutRisk[] = [];
  const seen = new Set<string>();

  visitRiskNode(node, path, ancestorChain, screenSizes, risks, seen);

  const siblingNames = siblingNamesWithRootMaxWidth(parentNode, nodeId(node));
  if (
    maxWidth(node) === undefined &&
    hasDescendantMaxWidth(node) &&
    siblingNames.length > 0
  ) {
    addRisk(
      risks,
      {
        type: "sibling-width-mismatch",
        severity: "high",
        nodePath: path,
        message:
          "A sibling is width-capped at the root while this instance only caps descendants; compare them inside the screen column.",
        evidence: {
          siblingRootMaxWidth: siblingNames,
        },
      },
      seen,
    );
  }

  return risks.sort((left, right) => {
    const severityRank = { high: 0, medium: 1, low: 2 };
    const bySeverity =
      severityRank[left.severity] - severityRank[right.severity];
    return bySeverity === 0
      ? left.nodePath.localeCompare(right.nodePath)
      : bySeverity;
  });
}

export function layoutRisksForTree(
  node: DocumentNode,
  path = "root",
): LayoutRisk[] {
  return layoutRisksForUsage({
    node,
    path,
    ancestorChain: [],
    screenSizes: [],
  });
}

export function readVariantProps(
  node: DocumentNode,
): Record<string, boolean | string> | undefined {
  const properties = readRecord(node, "componentProperties");
  if (!properties) {
    return undefined;
  }

  const output: Record<string, boolean | string> = {};
  for (const [name, rawValue] of Object.entries(properties)) {
    if (!rawValue || typeof rawValue !== "object") {
      continue;
    }
    const value = (rawValue as Record<string, unknown>).value;
    if (typeof value === "string" || typeof value === "boolean") {
      output[name] = value;
    }
  }

  return Object.keys(output).length > 0 ? output : undefined;
}
