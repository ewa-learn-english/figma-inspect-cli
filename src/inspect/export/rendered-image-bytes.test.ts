import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  RENDERED_PNG_BYTES,
  RENDERED_RGBA_BYTES,
} from "../../../test/fixtures/rendered-image.js";
import { normalizeRenderedImageBytes } from "./rendered-image-bytes.js";

describe("normalizeRenderedImageBytes", () => {
  it("encodes WebP without changing RGBA, including transparent pixel colors", async () => {
    const bytes = await normalizeRenderedImageBytes(
      RENDERED_PNG_BYTES,
      "webp",
      "1:2",
      "nested asset",
    );

    const image = sharp(bytes);
    await expect(image.metadata()).resolves.toMatchObject({
      format: "webp",
      width: 2,
      height: 2,
    });
    await expect(image.raw().toBuffer()).resolves.toEqual(RENDERED_RGBA_BYTES);
  });

  it("preserves an embedded ICC profile", async () => {
    const png = await sharp(RENDERED_PNG_BYTES)
      .withIccProfile("p3")
      .png()
      .toBuffer();
    const sourceProfile = (await sharp(png).metadata()).icc;
    expect(sourceProfile).toBeDefined();

    const bytes = await normalizeRenderedImageBytes(
      png,
      "webp",
      "1:2",
      "preview",
    );

    expect((await sharp(bytes).metadata()).icc).toEqual(sourceProfile);
    await expect(sharp(bytes).raw().toBuffer()).resolves.toEqual(
      await sharp(png).raw().toBuffer(),
    );
  });

  it("rejects a truncated PNG rather than writing an invalid WebP", async () => {
    await expect(
      normalizeRenderedImageBytes(
        RENDERED_PNG_BYTES.subarray(0, 8),
        "webp",
        "1:2",
        "preview",
      ),
    ).rejects.toThrow("Cannot encode WebP preview for 1:2:");
  });

  it("rejects 16-bit PNG instead of silently reducing sample precision", async () => {
    const png = await sharp(RENDERED_PNG_BYTES)
      .toColourspace("rgb16")
      .png()
      .toBuffer();

    await expect(
      normalizeRenderedImageBytes(png, "webp", "1:2", "preview"),
    ).rejects.toThrow("WebP cannot preserve PNG samples deeper than 8 bits.");
  });

  it("rejects dimensions outside WebP limits without resizing", async () => {
    const png = await sharp({
      create: {
        width: 16384,
        height: 1,
        channels: 4,
        background: "transparent",
      },
    })
      .png()
      .toBuffer();

    await expect(
      normalizeRenderedImageBytes(png, "webp", "1:2", "preview"),
    ).rejects.toThrow("Cannot encode WebP preview for 1:2:");
  });
});
