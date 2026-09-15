"use server";

import { revalidatePath } from "next/cache";
import { ExecutionType, Importance } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createCaseSchema = z.object({
  projectId: z.string().min(1),
  suiteId: z.string().min(1),
  title: z.string().min(1).max(300),
  summary: z.string().max(5000).optional(),
});

const updateCaseSchema = z.object({
  caseId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1).max(300),
  summary: z.string().max(5000).optional(),
  preconditions: z.string().max(5000).optional(),
  steps: z.string().max(10000).optional(),
  expectedResult: z.string().max(5000).optional(),
  importance: z.nativeEnum(Importance),
  executionType: z.nativeEnum(ExecutionType),
});

export async function createCase(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = createCaseSchema.safeParse({
    projectId: formData.get("projectId"),
    suiteId: formData.get("suiteId"),
    title: formData.get("title"),
    summary: formData.get("summary") || undefined,
  });
  if (!parsed.success) return;

  const agg = await prisma.testCase.aggregate({
    where: { projectId: parsed.data.projectId },
    _max: { externalId: true },
  });
  const externalId = (agg._max.externalId ?? 0) + 1;

  const testCase = await prisma.testCase.create({
    data: {
      projectId: parsed.data.projectId,
      suiteId: parsed.data.suiteId,
      externalId,
      title: parsed.data.title,
      summary: parsed.data.summary ?? "",
      authorId: session.user.id,
    },
  });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/suites`);
  revalidatePath(
    `/${locale}/projects/${parsed.data.projectId}/cases/${testCase.id}`,
  );
}

export async function updateCase(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = updateCaseSchema.safeParse({
    caseId: formData.get("caseId"),
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    summary: formData.get("summary") || undefined,
    preconditions: formData.get("preconditions") || undefined,
    steps: formData.get("steps") || undefined,
    expectedResult: formData.get("expectedResult") || undefined,
    importance: formData.get("importance"),
    executionType: formData.get("executionType"),
  });
  if (!parsed.success) return;

  await prisma.testCase.update({
    where: { id: parsed.data.caseId },
    data: {
      title: parsed.data.title,
      summary: parsed.data.summary ?? "",
      preconditions: parsed.data.preconditions ?? "",
      steps: parsed.data.steps ?? "",
      expectedResult: parsed.data.expectedResult ?? "",
      importance: parsed.data.importance,
      executionType: parsed.data.executionType,
      version: { increment: 1 },
    },
  });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/suites`);
  revalidatePath(
    `/${locale}/projects/${parsed.data.projectId}/cases/${parsed.data.caseId}`,
  );
}
