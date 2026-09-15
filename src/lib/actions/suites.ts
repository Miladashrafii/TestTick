"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const suiteSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  parentId: z.string().optional(),
});

export async function createSuite(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parentRaw = formData.get("parentId");
  const parsed = suiteSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    parentId: parentRaw && String(parentRaw) !== "" ? String(parentRaw) : undefined,
  });
  if (!parsed.success) return;

  const maxOrder = await prisma.testSuite.aggregate({
    where: { projectId: parsed.data.projectId, parentId: parsed.data.parentId ?? null },
    _max: { orderIndex: true },
  });

  await prisma.testSuite.create({
    data: {
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      parentId: parsed.data.parentId,
      authorId: session.user.id,
      orderIndex: (maxOrder._max.orderIndex ?? 0) + 1,
    },
  });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/suites`);
}
