"use server";

/**
 * Adapters between the result-returning actions in `@/lib/actions/*` and the two
 * shapes React forms accept: `<form action>` needs `Promise<void>`, and
 * `useActionState` needs `(state, formData)`.
 */

import {
  deleteCustomField,
  saveCustomField,
  setCaseFieldValue,
} from "@/lib/actions/custom-fields";
import { addCommentAction } from "@/lib/actions/activity";
import { deleteDataset, saveDataset } from "@/lib/actions/datasets";
import {
  appendSessionNote,
  endExploratorySession,
  startExploratorySession,
} from "@/lib/actions/exploratory";
import { createIssueLink, deleteIssueLink } from "@/lib/actions/issues";
import { setCaseReviewStatus, setPlanReviewStatus } from "@/lib/actions/review";
import { deleteView, saveView } from "@/lib/actions/views";
import { updateTheme } from "@/lib/actions/settings";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  type CreateApiKeyState,
} from "@/lib/actions/api-keys";
import {
  importCasesAction,
  type ImportCasesState,
} from "@/lib/actions/import-export";
import { prisma } from "@/lib/prisma";
import type { Theme } from "@/lib/theme";

export async function submitCaseReview(
  locale: string,
  formData: FormData,
): Promise<void> {
  await setCaseReviewStatus(locale, formData);
}

export async function submitPlanReview(
  locale: string,
  formData: FormData,
): Promise<void> {
  await setPlanReviewStatus(locale, formData);
}

export async function submitComment(
  locale: string,
  formData: FormData,
): Promise<void> {
  await addCommentAction(locale, formData);
}

export async function submitDataset(
  locale: string,
  formData: FormData,
): Promise<void> {
  await saveDataset(locale, formData);
}

export async function submitDatasetDelete(
  locale: string,
  formData: FormData,
): Promise<void> {
  await deleteDataset(locale, formData);
}

export async function submitIssueLink(
  locale: string,
  formData: FormData,
): Promise<void> {
  await createIssueLink(locale, formData);
}

export async function submitIssueUnlink(
  locale: string,
  formData: FormData,
): Promise<void> {
  await deleteIssueLink(locale, formData);
}

export async function submitSavedView(
  locale: string,
  formData: FormData,
): Promise<void> {
  await saveView(locale, formData);
}

export async function submitSavedViewDelete(
  locale: string,
  formData: FormData,
): Promise<void> {
  await deleteView(locale, formData);
}

export async function submitSessionStart(
  locale: string,
  formData: FormData,
): Promise<void> {
  await startExploratorySession(locale, formData);
}

export async function submitSessionNote(
  locale: string,
  formData: FormData,
): Promise<void> {
  await appendSessionNote(locale, formData);
}

export async function submitSessionEnd(
  locale: string,
  formData: FormData,
): Promise<void> {
  await endExploratorySession(locale, formData);
}

export async function submitCustomField(
  locale: string,
  formData: FormData,
): Promise<void> {
  await saveCustomField(locale, formData);
}

export async function submitCustomFieldDelete(
  locale: string,
  formData: FormData,
): Promise<void> {
  await deleteCustomField(locale, formData);
}

export async function submitApiKeyRevoke(
  locale: string,
  formData: FormData,
): Promise<void> {
  await revokeApiKeyAction(locale, formData);
}

export async function persistTheme(locale: string, theme: Theme): Promise<void> {
  const formData = new FormData();
  formData.set("theme", theme);
  await updateTheme(locale, formData);
}

/**
 * The single-value action is applied per field so the case detail form can save
 * every custom field in one submit.
 */
export async function submitCaseFieldValues(
  locale: string,
  formData: FormData,
): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  if (projectId.length === 0 || caseId.length === 0) return;

  const fields = await prisma.customField.findMany({
    where: { projectId, appliesTo: "testcase" },
    select: { id: true, fieldType: true },
  });

  for (const field of fields) {
    const raw = formData.get(`field_${field.id}`);
    if (field.fieldType !== "checkbox" && raw === null) continue;

    const value =
      field.fieldType === "checkbox" ? (raw === null ? "false" : "true") : String(raw);

    const fieldForm = new FormData();
    fieldForm.set("projectId", projectId);
    fieldForm.set("caseId", caseId);
    fieldForm.set("fieldId", field.id);
    fieldForm.set("value", value);
    await setCaseFieldValue(locale, fieldForm);
  }
}

export async function createApiKeyState(
  locale: string,
  _prev: CreateApiKeyState,
  formData: FormData,
): Promise<CreateApiKeyState> {
  return createApiKeyAction(locale, formData);
}

export async function importCasesState(
  locale: string,
  _prev: ImportCasesState,
  formData: FormData,
): Promise<ImportCasesState> {
  return importCasesAction(locale, formData);
}
