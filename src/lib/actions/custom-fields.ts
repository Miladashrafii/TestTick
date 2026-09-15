"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface CustomFieldResult {
  ok: boolean;
  fieldId: string | null;
  error: string | null;
}

const fieldSchema = z.object({
  projectId: z.string().min(1),
  fieldId: z.string().min(1).optional(),
  name: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "use lowercase letters, digits and underscores"),
  label: z.string().min(1).max(120),
  fieldType: z.enum(["string", "text", "number", "date", "list", "checkbox"]),
  options: z.string().max(2000).optional(),
  appliesTo: z.enum(["testcase", "user", "plan"]),
  required: z.boolean(),
});

const valueSchema = z.object({
  projectId: z.string().min(1),
  caseId: z.string().min(1),
  fieldId: z.string().min(1),
  value: z.string().max(5000),
});

export async function saveCustomField(
  locale: string,
  formData: FormData,
): Promise<CustomFieldResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, fieldId: null, error: "unauthorized" };

  const parsed = fieldSchema.safeParse({
    projectId: formData.get("projectId"),
    fieldId: formData.get("fieldId") || undefined,
    name: String(formData.get("name") ?? "").toLowerCase(),
    label: formData.get("label"),
    fieldType: formData.get("fieldType") ?? "string",
    options: formData.get("options") || undefined,
    appliesTo: formData.get("appliesTo") ?? "testcase",
    required: formData.get("required") !== null,
  });
  if (!parsed.success) return { ok: false, fieldId: null, error: "invalidInput" };

  const data = {
    name: parsed.data.name,
    label: parsed.data.label,
    fieldType: parsed.data.fieldType,
    options: parsed.data.options ?? "",
    appliesTo: parsed.data.appliesTo,
    required: parsed.data.required,
  };

  const field = parsed.data.fieldId
    ? await prisma.customField.update({
        where: { id: parsed.data.fieldId },
        data,
        select: { id: true },
      })
    : await prisma.customField.create({
        data: { ...data, projectId: parsed.data.projectId },
        select: { id: true },
      });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/settings`);
  return { ok: true, fieldId: field.id, error: null };
}

export async function deleteCustomField(
  locale: string,
  formData: FormData,
): Promise<CustomFieldResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, fieldId: null, error: "unauthorized" };

  const projectId = String(formData.get("projectId") ?? "");
  const fieldId = String(formData.get("fieldId") ?? "");
  if (projectId.length === 0 || fieldId.length === 0) {
    return { ok: false, fieldId: null, error: "invalidInput" };
  }

  await prisma.customField.deleteMany({ where: { id: fieldId, projectId } });
  revalidatePath(`/${locale}/projects/${projectId}/settings`);

  return { ok: true, fieldId, error: null };
}

export async function setCaseFieldValue(
  locale: string,
  formData: FormData,
): Promise<CustomFieldResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, fieldId: null, error: "unauthorized" };

  const parsed = valueSchema.safeParse({
    projectId: formData.get("projectId"),
    caseId: formData.get("caseId"),
    fieldId: formData.get("fieldId"),
    value: formData.get("value") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldId: null, error: "invalidInput" };

  await prisma.customFieldValue.upsert({
    where: { fieldId_caseId: { fieldId: parsed.data.fieldId, caseId: parsed.data.caseId } },
    create: {
      fieldId: parsed.data.fieldId,
      caseId: parsed.data.caseId,
      value: parsed.data.value,
      userId: session.user.id,
    },
    update: { value: parsed.data.value, userId: session.user.id },
  });

  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/cases/${parsed.data.caseId}`);
  return { ok: true, fieldId: parsed.data.fieldId, error: null };
}
