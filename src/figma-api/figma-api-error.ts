export class FigmaApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaApiError";
  }
}

/** Figma refused the response size, or its body exceeds a Node.js string. */
export class FigmaResponseTooLargeError extends FigmaApiError {
  constructor(message: string) {
    super(message);
    this.name = "FigmaResponseTooLargeError";
  }
}

/**
 * The file endpoints cannot read this file, such as a FigJam board, a Slides
 * deck, or a file whose owner disabled exporting.
 */
export class FigmaUnreadableFileError extends FigmaApiError {
  constructor(message: string) {
    super(message);
    this.name = "FigmaUnreadableFileError";
  }
}
