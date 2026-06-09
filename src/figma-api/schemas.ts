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
export type FigmaTeamProjectFile = FigmaFile & {
  project_id: string;
  project_name: string;
};
export type FigmaPage = z.infer<typeof figmaPageSchema>;

const publishedComponentSetSchema = z.object({
  key: z.string(),
  file_key: z.string(),
  node_id: z.string(),
  name: z.string(),
});

export type FigmaPublishedComponentSet = z.infer<
  typeof publishedComponentSetSchema
>;

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

const teamComponentSetsResponseSchema = z
  .object({
    meta: z.object({
      component_sets: z.array(z.unknown()),
      cursor: z
        .object({
          after: z.union([z.string(), z.number()]).optional(),
        })
        .optional(),
    }),
  })
  .transform(({ meta }) => ({
    componentSets: parseValidEntries(
      publishedComponentSetSchema,
      meta.component_sets,
    ),
    cursorAfter:
      meta.cursor?.after === undefined ? undefined : String(meta.cursor.after),
  }));

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

export function parseTeamComponentSetsResponse(payload: unknown): {
  componentSets: FigmaPublishedComponentSet[];
  cursorAfter: string | undefined;
} {
  return parseFigmaResponse(
    teamComponentSetsResponseSchema,
    payload,
    "Invalid Figma team component sets response.",
  );
}
