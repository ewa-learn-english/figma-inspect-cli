import { describe, expect, it } from "vitest";
import { normalizeExportedSvgBytes } from "./normalize-exported-svg.js";

describe("normalizeExportedSvgBytes", () => {
  it("strips width and height from the root svg element", () => {
    const input = new TextEncoder().encode(
      '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M0 0"/></svg>',
    );

    const output = new TextDecoder().decode(normalizeExportedSvgBytes(input));

    expect(output).toBe('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>');
  });

  it("leaves svg without dimensional attributes unchanged", () => {
    const input = new TextEncoder().encode(
      '<svg viewBox="0 0 16 16"><circle r="8"/></svg>',
    );

    const output = new TextDecoder().decode(normalizeExportedSvgBytes(input));

    expect(output).toBe('<svg viewBox="0 0 16 16"><circle r="8"/></svg>');
  });
});
