import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseValidEntries, parseValidRecord } from "./parse-valid-entries.js";

const itemSchema = z.object({
  id: z.string(),
  value: z.number(),
});

describe("parseValidEntries", () => {
  it("keeps entries that match the schema", () => {
    const entries = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ];

    expect(parseValidEntries(itemSchema, entries)).toEqual(entries);
  });

  it("drops invalid entries instead of throwing", () => {
    const entries = [
      { id: "a", value: 1 },
      { id: "b", value: "not-a-number" },
      null,
      { id: "c", value: 3 },
    ];

    expect(parseValidEntries(itemSchema, entries)).toEqual([
      { id: "a", value: 1 },
      { id: "c", value: 3 },
    ]);
  });
});

describe("parseValidRecord", () => {
  it("parses object values and skips invalid entries", () => {
    const value = {
      one: { id: "a", value: 1 },
      two: { id: "b", value: "bad" },
      three: { id: "c", value: 3 },
    };

    expect(parseValidRecord(itemSchema, value)).toEqual({
      one: { id: "a", value: 1 },
      three: { id: "c", value: 3 },
    });
  });

  it("returns an empty object for non-object inputs", () => {
    expect(parseValidRecord(itemSchema, null)).toEqual({});
    expect(parseValidRecord(itemSchema, "nope")).toEqual({});
    expect(parseValidRecord(itemSchema, [])).toEqual({});
  });
});
