"use server";

import { revalidatePath } from "next/cache";
import { Role, ProjectStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  prefix: z.string().min(2).max(8).regex(/^[A-Z0-9]+$/),
  description: z.string().max(2000).optional(),
});

export async function createProject(locale: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    prefix: String(formData.get("prefix") ?? "").toUpperCase(),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return;

  const role =
    session.user.role === "ADMINISTRATOR"
      ? Role.ADMINISTRATOR
      : Role.LEADER;

  await prisma.testProject.create({
    data: {
      name: parsed.data.name,
      prefix: parsed.data.prefix,
      description: parsed.data.description ?? "",
      status: ProjectStatus.ACTIVE,
      members: {
        create: { userId: session.user.id, role },
      },
    },
  });

  revalidatePath(`/${locale}/projects`);
  revalidatePath(`/${locale}/dashboard`);
}
