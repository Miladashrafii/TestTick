"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface ExploratoryResult {
  ok: boolean;
  sessionId: string | null;
  error: string | null;
}

const startSchema = z.object({
  projectId: z.string().min(1),
  charter: z.string().min(1).max(500),
  mission: z.string().max(1000).optional(),
  durationMin: z.coerce.number().int().min(5).max(480),
});

const noteSchema = z.object({
  projectId: z.string().min(1),
  sessionId: z.string().min(1),
  note: z.string().min(1).max(5000),
});

const endSchema = z.object({
  projectId: z.string().min(1),
  sessionId: z.string().min(1),
  status: z.enum(["completed", "abandoned"]),
});

export async function startExploratorySession(
  locale: string,
  formData: FormData,
): Promise<ExploratoryResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, sessionId: null, error: "unauthorized" };

  const parsed = startSchema.safeParse({
    projectId: formData.get("projectId"),
    charter: formData.get("charter"),
    mission: formData.get("mission") || undefined,
    durationMin: formData.get("durationMin") ?? 60,
  });
  if (!parsed.success) return { ok: false, sessionId: null, error: "invalidInput" };

  const created = await prisma.exploratorySession.create({
    data: {
      projectId: parsed.data.projectId,
      ownerId: session.user.id,
      charter: parsed.data.charter,
      mission: parsed.data.mission ?? "",
      durationMin: parsed.data.durationMin,
      status: "active",
    },
    select: { id: true },
  });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/exploratory`);
  return { ok: true, sessionId: created.id, error: null };
}

export async function appendSessionNote(
  locale: string,
  formData: FormData,
): Promise<ExploratoryResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, sessionId: null, error: "unauthorized" };

  const parsed = noteSchema.safeParse({
    projectId: formData.get("projectId"),
    sessionId: formData.get("sessionId"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { ok: false, sessionId: null, error: "invalidInput" };

  const existing = await prisma.exploratorySession.findFirst({
    where: { id: parsed.data.sessionId, projectId: parsed.data.projectId },
    select: { notes: true },
  });
  if (!existing) return { ok: false, sessionId: null, error: "notFound" };

  const stamp = new Date().toISOString().slice(11, 16);
  const line = `[${stamp}] ${parsed.data.note.trim()}`;
  const notes = existing.notes.length > 0 ? `${existing.notes}\n${line}` : line;

  await prisma.exploratorySession.update({
    where: { id: parsed.data.sessionId },
    data: { notes },
  });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/exploratory`);
  return { ok: true, sessionId: parsed.data.sessionId, error: null };
}

export async function endExploratorySession(
  locale: string,
  formData: FormData,
): Promise<ExploratoryResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, sessionId: null, error: "unauthorized" };

  const parsed = endSchema.safeParse({
    projectId: formData.get("projectId"),
    sessionId: formData.get("sessionId"),
    status: formData.get("status") ?? "completed",
  });
  if (!parsed.success) return { ok: false, sessionId: null, error: "invalidInput" };

  await prisma.exploratorySession.updateMany({
    where: { id: parsed.data.sessionId, projectId: parsed.data.projectId },
    data: { status: parsed.data.status, endedAt: new Date() },
  });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/exploratory`);
  return { ok: true, sessionId: parsed.data.sessionId, error: null };
}
