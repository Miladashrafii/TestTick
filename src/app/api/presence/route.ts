import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireProjectActor } from "@/lib/api/actor";
import { badRequest, jsonOk } from "@/lib/api/response";
import { listActivePresence, recordHeartbeat, PRESENCE_TTL_MS } from "@/lib/presence";

const heartbeatSchema = z.object({
  projectId: z.string().min(1),
  page: z.string().min(1).max(200),
  label: z.string().max(200).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return badRequest("projectId query parameter is required");

  const auth = await requireProjectActor(request, projectId);
  if (!auth.ok) return auth.response;

  const active = await listActivePresence(projectId);
  return jsonOk({ ttlMs: PRESENCE_TTL_MS, active });
}

export async function POST(request: NextRequest): Promise<Response> {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = heartbeatSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest("Invalid heartbeat payload", parsed.error.flatten());
  }

  const auth = await requireProjectActor(request, parsed.data.projectId);
  if (!auth.ok) return auth.response;

  await recordHeartbeat(
    auth.actor.userId,
    parsed.data.projectId,
    parsed.data.page,
    parsed.data.label ?? "",
  );

  const active = await listActivePresence(parsed.data.projectId);
  return jsonOk({ ttlMs: PRESENCE_TTL_MS, active });
}
