import { access } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";

export type ContractFormat = "json" | "yaml";

function dataFileExtension(format: ContractFormat): string {
  return format === "yaml" ? ".yaml" : ".json";
}

export function contractArtifactFileName(
  componentName: string,
  artifact: "visuals" | "geometry" | "meta",
  format: ContractFormat = "yaml",
): string {
  const extension = dataFileExtension(format);
  return `${componentName}.component-set.${artifact}${extension}`;
}

export function serializeContractData(
  value: unknown,
  format: ContractFormat,
): string {
  if (format === "yaml") {
    return stringify(value);
  }

  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function detectContractFormat(
  contractDir: string,
  componentName: string,
): Promise<ContractFormat> {
  try {
    await access(
      path.join(
        contractDir,
        contractArtifactFileName(componentName, "meta", "json"),
      ),
    );
    return "json";
  } catch {
    return "yaml";
  }
}
