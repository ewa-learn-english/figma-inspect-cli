import type { TeamComponentRegistry } from "./team-component-registry.js";

export interface SlimContext {
  propIdToName: Map<string, string>;
  teamComponents?: TeamComponentRegistry;
}
