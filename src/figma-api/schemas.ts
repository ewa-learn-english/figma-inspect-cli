import { z } from "zod";
import { parseValidEntries } from "../zod/parse-valid-entries.js";
import { FigmaApiError } from "./figma-api-error.js";

function parseFigmaResponse<T>(
  schema: z.ZodType<T>,
  payload: unknown,
  message: string,
): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new FigmaApiError(message);
  }

  return result.data;
}

const figmaProjectSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  file_count: z.number().optional(),
});

const figmaFileSchema = z.object({
  key: z.string(),
  name: z.string(),
  last_modified: z.string(),
});

const figmaPageSchema = z
  .object({
    type: z.literal("CANVAS"),
    id: z.string(),
    name: z.string(),
  })
  .transform(({ id, name }) => ({ id, name }));

export type FigmaProject = z.infer<typeof figmaProjectSchema>;
export type FigmaFile = z.infer<typeof figmaFileSchema>;
export type FigmaPage = z.infer<typeof figmaPageSchema>;

const teamProjectsResponseSchema = z
  .object({
    projects: z.array(z.unknown()),
  })
  .transform(({ projects }) => parseValidEntries(figmaProjectSchema, projects));

const projectFilesResponseSchema = z
  .object({
    files: z.array(z.unknown()),
  })
  .transform(({ files }) => parseValidEntries(figmaFileSchema, files));

const filePagesResponseSchema = z
  .object({
    document: z.object({
      children: z.array(z.unknown()),
    }),
  })
  .transform(({ document }) =>
    parseValidEntries(figmaPageSchema, document.children),
  );

export function parseTeamProjectsResponse(payload: unknown): FigmaProject[] {
  return parseFigmaResponse(
    teamProjectsResponseSchema,
    payload,
    "Invalid Figma team projects response.",
  );
}

export function parseProjectFilesResponse(payload: unknown): FigmaFile[] {
  return parseFigmaResponse(
    projectFilesResponseSchema,
    payload,
    "Invalid Figma project files response.",
  );
}

export function parseFilePagesResponse(payload: unknown): FigmaPage[] {
  return parseFigmaResponse(
    filePagesResponseSchema,
    payload,
    "Invalid Figma file response.",
  );
}
