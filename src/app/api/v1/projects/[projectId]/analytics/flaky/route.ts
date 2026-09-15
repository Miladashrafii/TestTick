import type { NextRequest } from "next/server";
import { requireProjectActor } from "@/lib/api/actor";
import { jsonOk } from "@/lib/api/response";
import { readInt, readString } from "@/lib/api/query";
import { getFlakyReport } from "@/lib/analytics/flaky";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await context.params;
  const auth = await requireProjectActor(request, projectId);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const report = await getFlakyReport(projectId, {
    sampleSize: readInt(params, "sampleSize"),
    planId: readString(params, "planId"),
  });

  return jsonOk(report);
}
