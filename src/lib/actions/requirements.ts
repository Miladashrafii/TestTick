"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const reqSchema = z.object({
  projectId: z.string().min(1),
  docId: z.string().min(1).max(64),
  title: z.string().min(1).max(300),
  scope: z.string().max(2000).optional(),
});

export async function createRequirement(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = reqSchema.safeParse({
    projectId: formData.get("projectId"),
    docId: formData.get("docId"),
    title: formData.get("title"),
    scope: formData.get("scope") || undefined,
  });
  if (!parsed.success) return;

  await prisma.requirement.create({
    data: {
      projectId: parsed.data.projectId,
      docId: parsed.data.docId,
      title: parsed.data.title,
      scope: parsed.data.scope ?? "",
      authorId: session.user.id,
    },
  });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/requirements`);
  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/reports`);
}
