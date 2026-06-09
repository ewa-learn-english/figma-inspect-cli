export class FigmaInspectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaInspectError";
  }
}
