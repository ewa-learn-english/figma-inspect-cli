function stripRootSvgDimensions(attrs: string): string {
  return attrs
    .replace(/\s+width=["'][^"']*["']/gi, "")
    .replace(/\s+height=["'][^"']*["']/gi, "");
}

function normalizeExportedSvg(source: string): string {
  return source.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    return `<svg${stripRootSvgDimensions(attrs)}>`;
  });
}

export function normalizeExportedSvgBytes(bytes: Uint8Array): Uint8Array {
  const text = new TextDecoder().decode(bytes);
  return new TextEncoder().encode(normalizeExportedSvg(text));
}
