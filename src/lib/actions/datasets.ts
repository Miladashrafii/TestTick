"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseDatasetRows, serializeDatasetRows } from "@/lib/datasets";

export type { DatasetRow } from "@/lib/datasets";

export interface DatasetResult {
  ok: boolean;
  datasetId: string | null;
  error: string | null;
}

const upsertSchema = z.object({
  projectId: z.string().min(1),
  caseId: z.string().min(1),
  datasetId: z.string().min(1).optional(),
  name: z.string().min(1).max(120),
  rowsJson: z.string().max(100_000),
});

function normalizeRows(rowsJson: string): string | null {
  const rows = parseDatasetRows(rowsJson);
  return rows.length > 0 ? serializeDatasetRows(rows) : null;
}

export async function saveDataset(locale: string, formData: FormData): Promise<DatasetResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, datasetId: null, error: "unauthorized" };

  const parsed = upsertSchema.safeParse({
    projectId: formData.get("projectId"),
    caseId: formData.get("caseId"),
    datasetId: formData.get("datasetId") || undefined,
    name: formData.get("name"),
    rowsJson: formData.get("rowsJson") ?? "[]",
  });
  if (!parsed.success) return { ok: false, datasetId: null, error: "invalidInput" };

  const rowsJson = normalizeRows(parsed.data.rowsJson);
  if (rowsJson === null) return { ok: false, datasetId: null, error: "invalidRows" };

  const dataset = parsed.data.datasetId
    ? await prisma.caseDataset.update({
        where: { id: parsed.data.datasetId },
        data: { name: parsed.data.name, rowsJson },
        select: { id: true },
      })
    : await prisma.caseDataset.create({
        data: { caseId: parsed.data.caseId, name: parsed.data.name, rowsJson },
        select: { id: true },
      });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/cases/${parsed.data.caseId}`);
  return { ok: true, datasetId: dataset.id, error: null };
}

export async function deleteDataset(locale: string, formData: FormData): Promise<DatasetResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, datasetId: null, error: "unauthorized" };

  const projectId = String(formData.get("projectId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  const datasetId = String(formData.get("datasetId") ?? "");
  if (projectId.length === 0 || caseId.length === 0 || datasetId.length === 0) {
    return { ok: false, datasetId: null, error: "invalidInput" };
  }

  await prisma.caseDataset.deleteMany({ where: { id: datasetId, caseId } });
  revalidatePath(`/${locale}/projects/${projectId}/cases/${caseId}`);

  return { ok: true, datasetId, error: null };
}
