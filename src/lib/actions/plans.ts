"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const planSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const buildSchema = z.object({
  projectId: z.string().min(1),
  planId: z.string().min(1),
  name: z.string().min(1).max(120),
  notes: z.string().max(2000).optional(),
});

const platformSchema = z.object({
  projectId: z.string().min(1),
  planId: z.string().min(1),
  name: z.string().min(1).max(120),
});

const assignSchema = z.object({
  projectId: z.string().min(1),
  planId: z.string().min(1),
  caseIds: z.array(z.string().min(1)).min(1),
});

function planPaths(locale: string, projectId: string, planId?: string) {
  const base = `/${locale}/projects/${projectId}`;
  const paths = [`${base}/plans`];
  if (planId) paths.push(`${base}/plans/${planId}`, `${base}/execution`);
  return paths;
}

export async function createPlan(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = planSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return;

  await prisma.testPlan.create({
    data: {
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      authorId: session.user.id,
    },
  });

  for (const p of planPaths(locale, parsed.data.projectId)) {
    revalidatePath(p);
  }
}

export async function createBuild(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = buildSchema.safeParse({
    projectId: formData.get("projectId"),
    planId: formData.get("planId"),
    name: formData.get("name"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return;

  await prisma.build.create({
    data: {
      planId: parsed.data.planId,
      name: parsed.data.name,
      notes: parsed.data.notes ?? "",
    },
  });

  for (const p of planPaths(locale, parsed.data.projectId, parsed.data.planId)) {
    revalidatePath(p);
  }
}

export async function createPlatformForPlan(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = platformSchema.safeParse({
    projectId: formData.get("projectId"),
    planId: formData.get("planId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  const platform = await prisma.platform.upsert({
    where: {
      projectId_name: {
        projectId: parsed.data.projectId,
        name: parsed.data.name,
      },
    },
    create: {
      projectId: parsed.data.projectId,
      name: parsed.data.name,
    },
    update: {},
  });

  await prisma.planPlatform.upsert({
    where: {
      planId_platformId: {
        planId: parsed.data.planId,
        platformId: platform.id,
      },
    },
    create: {
      planId: parsed.data.planId,
      platformId: platform.id,
    },
    update: {},
  });

  for (const p of planPaths(locale, parsed.data.projectId, parsed.data.planId)) {
    revalidatePath(p);
  }
}

export async function assignCasesToPlan(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const caseIds = formData.getAll("caseIds").map(String);
  const parsed = assignSchema.safeParse({
    projectId: formData.get("projectId"),
    planId: formData.get("planId"),
    caseIds,
  });
  if (!parsed.success) return;

  for (const caseId of parsed.data.caseIds) {
    await prisma.planTestCase.upsert({
      where: {
        planId_caseId: {
          planId: parsed.data.planId,
          caseId,
        },
      },
      create: {
        planId: parsed.data.planId,
        caseId,
      },
      update: {},
    });
  }

  for (const p of planPaths(locale, parsed.data.projectId, parsed.data.planId)) {
    revalidatePath(p);
  }
}
