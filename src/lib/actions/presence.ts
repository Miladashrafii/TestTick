"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { listActivePresence, recordHeartbeat, type PresenceEntry } from "@/lib/presence";

const heartbeatSchema = z.object({
  projectId: z.string().min(1),
  page: z.string().min(1).max(200),
  label: z.string().max(200).optional(),
});

export async function heartbeat(
  projectId: string,
  page: string,
  label = "",
): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };

  const parsed = heartbeatSchema.safeParse({ projectId, page, label });
  if (!parsed.success) return { ok: false };

  await recordHeartbeat(
    session.user.id,
    parsed.data.projectId,
    parsed.data.page,
    parsed.data.label ?? "",
  );
  return { ok: true };
}

export async function listActive(projectId: string): Promise<PresenceEntry[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  return listActivePresence(projectId);
}
