import { prisma } from "@/lib/prisma";

export type ExploratoryStatus = "active" | "completed" | "abandoned";

export interface ExploratorySessionSummary {
  id: string;
  charter: string;
  mission: string;
  notes: string;
  durationMin: number;
  startedAt: Date;
  endedAt: Date | null;
  status: string;
  ownerId: string;
  ownerName: string;
  /** Minutes left in the time box, or null once the session ended. */
  remainingMin: number | null;
}

export function remainingMinutes(
  startedAt: Date,
  durationMin: number,
  endedAt: Date | null,
): number | null {
  if (endedAt) return null;
  const elapsedMin = (Date.now() - startedAt.getTime()) / 60_000;
  return Math.max(0, Math.round(durationMin - elapsedMin));
}

export async function listExploratorySessions(
  projectId: string,
  options: { status?: string; ownerId?: string } = {},
): Promise<ExploratorySessionSummary[]> {
  const sessions = await prisma.exploratorySession.findMany({
    where: {
      projectId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.ownerId ? { ownerId: options.ownerId } : {}),
    },
    orderBy: { startedAt: "desc" },
    include: { owner: { select: { name: true } } },
  });

  return sessions.map((session) => ({
    id: session.id,
    charter: session.charter,
    mission: session.mission,
    notes: session.notes,
    durationMin: session.durationMin,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    status: session.status,
    ownerId: session.ownerId,
    ownerName: session.owner.name,
    remainingMin: remainingMinutes(session.startedAt, session.durationMin, session.endedAt),
  }));
}
