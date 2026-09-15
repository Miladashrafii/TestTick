"use server";

import { revalidatePath } from "next/cache";
import { ExecutionStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const recordSchema = z.object({
  projectId: z.string().min(1),
  planCaseId: z.string().min(1),
  buildId: z.string().min(1),
  platformId: z.string().optional(),
  status: z.nativeEnum(ExecutionStatus),
  notes: z.string().max(5000).optional(),
});

export async function recordExecution(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const platformRaw = formData.get("platformId");
  const parsed = recordSchema.safeParse({
    projectId: formData.get("projectId"),
    planCaseId: formData.get("planCaseId"),
    buildId: formData.get("buildId"),
    platformId:
      platformRaw && String(platformRaw) !== "" ? String(platformRaw) : undefined,
    status: formData.get("status"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return;

  await prisma.execution.create({
    data: {
      planCaseId: parsed.data.planCaseId,
      buildId: parsed.data.buildId,
      platformId: parsed.data.platformId,
      status: parsed.data.status,
      notes: parsed.data.notes ?? "",
      executorId: session.user.id,
    },
  });

  const base = `/${locale}/projects/${parsed.data.projectId}`;
  revalidatePath(`${base}/execution`);
  revalidatePath(`${base}/reports`);
  revalidatePath(`/${locale}/dashboard`);
}
