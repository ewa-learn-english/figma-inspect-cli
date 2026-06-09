export function collectVariantAxes(
  allVariants: Record<string, string>[],
): Record<string, string[]> {
  const axes = new Map<string, Set<string>>();

  for (const variant of allVariants) {
    for (const [key, value] of Object.entries(variant)) {
      const values = axes.get(key) ?? new Set<string>();
      values.add(value);
      axes.set(key, values);
    }
  }

  return Object.fromEntries(
    [...axes.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [key, [...values].sort()]),
  );
}
