import type { NextRequest } from "next/server";
import { requireProjectActor } from "@/lib/api/actor";
import { badRequest, fileResponse, jsonOk } from "@/lib/api/response";
import { readString } from "@/lib/api/query";
import {
  detectTransferFormat,
  exportCases,
  importCases,
  isTransferFormat,
  TRANSFER_FORMATS,
} from "@/lib/import-export";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await context.params;
  const auth = await requireProjectActor(request, projectId);
  if (!auth.ok) return auth.response;

  const requested = request.nextUrl.searchParams.get("format") ?? "json";
  if (!isTransferFormat(requested)) {
    return badRequest(`format must be one of: ${TRANSFER_FORMATS.join(", ")}`);
  }

  const file = await exportCases(projectId, requested);
  return fileResponse(file.body, file.contentType, file.filename);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await context.params;
  const auth = await requireProjectActor(request, projectId);
  if (!auth.ok) return auth.response;

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const requested = readString(request.nextUrl.searchParams, "format");

  let content: string | Uint8Array;
  let filename: string | undefined;
  let detectedType: string | null = contentType;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return badRequest("Attach the file to import as the `file` field");
    }
    content = new Uint8Array(await file.arrayBuffer());
    filename = file.name;
    detectedType = file.type;
  } else if (contentType.includes("spreadsheet") || contentType.includes("octet-stream")) {
    content = new Uint8Array(await request.arrayBuffer());
  } else {
    content = await request.text();
  }

  const format = isTransferFormat(requested)
    ? requested
    : detectTransferFormat(filename, detectedType);
  if (!format) {
    return badRequest(`Could not detect format; pass ?format=${TRANSFER_FORMATS.join("|")}`);
  }

  const result = await importCases({
    projectId,
    format,
    content,
    options: { authorId: auth.actor.userId },
  });

  return jsonOk({ format, ...result });
}
