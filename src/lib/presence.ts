import { prisma } from "@/lib/prisma";

/** A heartbeat older than this is treated as "gone". */
export const PRESENCE_TTL_MS = 45_000;
/** Rows this old are pruned opportunistically on read. */
const PRESENCE_PRUNE_MS = 30 * 60_000;

export interface PresenceEntry {
  userId: string;
  userName: string;
  userEmail: string;
  page: string;
  label: string;
  updatedAt: Date;
}

export async function recordHeartbeat(
  userId: string,
  projectId: string,
  page: string,
  label: string,
): Promise<void> {
  await prisma.presence.upsert({
    where: { userId_projectId_page: { userId, projectId, page } },
    create: { userId, projectId, page, label },
    // updatedAt is written explicitly so an unchanged label still refreshes the heartbeat.
    update: { label, updatedAt: new Date() },
  });
}

export async function listActivePresence(projectId: string): Promise<PresenceEntry[]> {
  const since = new Date(Date.now() - PRESENCE_TTL_MS);
  const rows = await prisma.presence.findMany({
    where: { projectId, updatedAt: { gte: since } },
    orderBy: { updatedAt: "desc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return rows.map((row) => ({
    userId: row.user.id,
    userName: row.user.name,
    userEmail: row.user.email,
    page: row.page,
    label: row.label,
    updatedAt: row.updatedAt,
  }));
}

export async function prunePresence(): Promise<number> {
  const { count } = await prisma.presence.deleteMany({
    where: { updatedAt: { lt: new Date(Date.now() - PRESENCE_PRUNE_MS) } },
  });
  return count;
}
