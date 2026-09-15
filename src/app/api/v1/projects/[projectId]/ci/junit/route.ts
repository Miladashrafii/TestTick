import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireProjectActor } from "@/lib/api/actor";
import { badRequest, jsonCreated, jsonError } from "@/lib/api/response";
import { readString } from "@/lib/api/query";
import { importJUnitXml, JUnitImportError } from "@/lib/ci/junit";

const bodySchema = z.object({
  planId: z.string().min(1).optional(),
  buildId: z.string().min(1).optional(),
  buildName: z.string().min(1).max(120).optional(),
  platformId: z.string().min(1).optional(),
  xml: z.string().min(1).optional(),
});

type Payload = z.infer<typeof bodySchema>;

/**
 * Accepts either a raw JUnit XML body (with plan/build passed as query parameters) or a JSON
 * envelope carrying the XML, which keeps both `curl --data-binary @report.xml` and scripted
 * clients working against the same endpoint.
 */
async function readPayload(request: NextRequest): Promise<Payload | { error: string }> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const params = request.nextUrl.searchParams;
  const fromQuery: Payload = {
    planId: readString(params, "planId"),
    buildId: readString(params, "buildId"),
    buildName: readString(params, "buildName"),
    platformId: readString(params, "platformId"),
  };

  if (contentType.includes("application/json")) {
    const raw: unknown = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return { error: "Invalid JSON payload" };
    return {
      planId: parsed.data.planId ?? fromQuery.planId,
      buildId: parsed.data.buildId ?? fromQuery.buildId,
      buildName: parsed.data.buildName ?? fromQuery.buildName,
      platformId: parsed.data.platformId ?? fromQuery.platformId,
      xml: parsed.data.xml,
    };
  }

  const xml = await request.text();
  return { ...fromQuery, xml };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await context.params;
  const auth = await requireProjectActor(request, projectId);
  if (!auth.ok) return auth.response;

  const payload = await readPayload(request);
  if ("error" in payload) return badRequest(payload.error);
  if (!payload.planId) return badRequest("planId is required");
  if (!payload.xml || payload.xml.trim().length === 0) {
    return badRequest("Request body must contain JUnit XML");
  }
  if (!payload.buildId && !payload.buildName) {
    return badRequest("Provide either buildId or buildName");
  }

  try {
    const summary = await importJUnitXml({
      projectId,
      planId: payload.planId,
      xml: payload.xml,
      buildId: payload.buildId,
      buildName: payload.buildName,
      platformId: payload.platformId,
      executorId: auth.actor.userId,
    });
    return jsonCreated(summary);
  } catch (error) {
    if (error instanceof JUnitImportError) return badRequest(error.message);
    return jsonError(500, "JUnit import failed");
  }
}
