import { stringify } from "yaml";

export type ContractFormat = "json" | "yaml";

function dataFileExtension(format: ContractFormat): string {
  return format === "yaml" ? ".yaml" : ".json";
}

export function contractArtifactFileName(
  componentName: string,
  artifact: "visuals" | "geometry" | "meta" | "assets" | "raw",
  format: ContractFormat = "yaml",
): string {
  const extension = dataFileExtension(format);
  if (artifact === "raw") {
    return `${componentName}${extension}`;
  }

  return `${componentName}.contract.${artifact}${extension}`;
}

export function serializeContractData(
  value: unknown,
  format: ContractFormat,
): string {
  if (format === "yaml") {
    return `${stringify(value)}\n`;
  }

  return `${JSON.stringify(value, null, 2)}\n`;
}
