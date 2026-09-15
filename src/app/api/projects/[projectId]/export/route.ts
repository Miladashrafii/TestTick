import type { NextRequest } from "next/server";
import { requireProjectActor } from "@/lib/api/actor";
import { badRequest, fileResponse } from "@/lib/api/response";
import { exportCases, isTransferFormat } from "@/lib/import-export";

/** Streams a project's test cases as an attachment so the UI can link to it directly. */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/projects/[projectId]/export">,
): Promise<Response> {
  const { projectId } = await ctx.params;

  const auth = await requireProjectActor(request, projectId);
  if (!auth.ok) return auth.response;

  const requested = request.nextUrl.searchParams.get("format") ?? "json";
  if (!isTransferFormat(requested)) {
    return badRequest(`Unsupported export format: ${requested}`);
  }

  const file = await exportCases(projectId, requested);
  return fileResponse(file.body, file.contentType, file.filename);
}
