interface TableColumn<T> {
  header: string;
  value: (row: T) => string;
}

function pad(value: string, length: number): string {
  return value + " ".repeat(Math.max(0, length - value.length));
}

export function formatTable<T>(
  columns: TableColumn<T>[],
  rows: readonly T[],
): string {
  const widths = columns.map((column) =>
    Math.max(
      column.header.length,
      ...rows.map((row) => column.value(row).length),
    ),
  );

  const header = columns
    .map((column, index) => pad(column.header, widths[index]))
    .join("  ");
  const divider = widths.map((width) => "-".repeat(width)).join("  ");
  const body = rows.map((row) =>
    columns
      .map((column, index) => pad(column.value(row), widths[index]))
      .join("  "),
  );

  return [header, divider, ...body].join("\n");
}

export function writeJsonOrTable<T>(
  items: readonly T[],
  json: boolean,
  stdout: NodeJS.WriteStream,
  emptyMessage: string,
  renderTable: (items: readonly T[]) => string,
): void {
  if (json) {
    stdout.write(`${JSON.stringify(items, null, 2)}\n`);
    return;
  }

  if (items.length === 0) {
    stdout.write(`${emptyMessage}\n`);
    return;
  }

  stdout.write(`${renderTable(items)}\n`);
}
