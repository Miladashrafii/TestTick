"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseViewFilters } from "@/lib/saved-views";

export interface SavedViewResult {
  ok: boolean;
  viewId: string | null;
  error: string | null;
}

const saveSchema = z.object({
  projectId: z.string().min(1),
  viewId: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  entity: z.enum(["cases", "plans", "executions", "requirements"]),
  filtersJson: z.string().max(10_000),
  shared: z.boolean(),
});

export async function saveView(locale: string, formData: FormData): Promise<SavedViewResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, viewId: null, error: "unauthorized" };

  const parsed = saveSchema.safeParse({
    projectId: formData.get("projectId"),
    viewId: formData.get("viewId") || undefined,
    name: formData.get("name"),
    entity: formData.get("entity") ?? "cases",
    filtersJson: formData.get("filtersJson") ?? "{}",
    shared: formData.get("shared") !== null,
  });
  if (!parsed.success) return { ok: false, viewId: null, error: "invalidInput" };

  const filtersJson = JSON.stringify(parseViewFilters(parsed.data.filtersJson));

  const view = parsed.data.viewId
    ? await prisma.savedView.update({
        where: { id: parsed.data.viewId },
        data: {
          name: parsed.data.name,
          entity: parsed.data.entity,
          filtersJson,
          shared: parsed.data.shared,
        },
        select: { id: true },
      })
    : await prisma.savedView.create({
        data: {
          projectId: parsed.data.projectId,
          ownerId: session.user.id,
          name: parsed.data.name,
          entity: parsed.data.entity,
          filtersJson,
          shared: parsed.data.shared,
        },
        select: { id: true },
      });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}`);
  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/${parsed.data.entity}`);

  return { ok: true, viewId: view.id, error: null };
}

export async function deleteView(locale: string, formData: FormData): Promise<SavedViewResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, viewId: null, error: "unauthorized" };

  const projectId = String(formData.get("projectId") ?? "");
  const viewId = String(formData.get("viewId") ?? "");
  if (projectId.length === 0 || viewId.length === 0) {
    return { ok: false, viewId: null, error: "invalidInput" };
  }

  // Owners delete their own views; project administrators can delete shared ones.
  const view = await prisma.savedView.findFirst({
    where: { id: viewId, projectId },
    select: { ownerId: true },
  });
  if (!view) return { ok: false, viewId: null, error: "notFound" };
  if (view.ownerId !== session.user.id && session.user.role !== "ADMINISTRATOR") {
    return { ok: false, viewId: null, error: "forbidden" };
  }

  await prisma.savedView.delete({ where: { id: viewId } });
  revalidatePath(`/${locale}/projects/${projectId}`);

  return { ok: true, viewId, error: null };
}
