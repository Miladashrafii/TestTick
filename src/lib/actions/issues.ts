"use server";

import { revalidatePath } from "next/cache";
import type { IssueProvider } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ISSUE_PROVIDERS } from "@/lib/enums";
import {
  buildIssueUrl,
  buildTemplateFromExecution,
  type IssueTemplate,
} from "@/lib/issues";

export interface IssueLinkResult {
  ok: boolean;
  issueLinkId: string | null;
  error: string | null;
}

export interface IssueDraft extends IssueTemplate {
  /** Ready-to-open deep link, or null when no tracker base URL is configured. */
  url: string | null;
  provider: IssueProvider;
}

const createSchema = z.object({
  projectId: z.string().min(1),
  provider: z.enum(ISSUE_PROVIDERS),
  url: z.string().url().max(2000),
  externalId: z.string().max(200).optional(),
  title: z.string().max(500).optional(),
  caseId: z.string().min(1).optional(),
  executionId: z.string().min(1).optional(),
});

/** Falls back to the issue number in the URL so a link is always identifiable. */
function inferExternalId(url: string): string {
  const match = /\/(?:issues|browse|issue)\/([A-Za-z0-9-]+)/.exec(url);
  return match?.[1] ?? "";
}

export async function createIssueLink(
  locale: string,
  formData: FormData,
): Promise<IssueLinkResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, issueLinkId: null, error: "unauthorized" };

  const parsed = createSchema.safeParse({
    projectId: formData.get("projectId"),
    provider: formData.get("provider") ?? "GITHUB",
    url: formData.get("url"),
    externalId: formData.get("externalId") || undefined,
    title: formData.get("title") || undefined,
    caseId: formData.get("caseId") || undefined,
    executionId: formData.get("executionId") || undefined,
  });
  if (!parsed.success) return { ok: false, issueLinkId: null, error: "invalidInput" };

  const link = await prisma.issueLink.create({
    data: {
      projectId: parsed.data.projectId,
      provider: parsed.data.provider,
      url: parsed.data.url,
      externalId: parsed.data.externalId ?? inferExternalId(parsed.data.url),
      title: parsed.data.title ?? "",
      caseId: parsed.data.caseId,
      executionId: parsed.data.executionId,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  const base = `/${locale}/projects/${parsed.data.projectId}`;
  if (parsed.data.caseId) revalidatePath(`${base}/cases/${parsed.data.caseId}`);
  revalidatePath(`${base}/execution`);

  return { ok: true, issueLinkId: link.id, error: null };
}

export async function deleteIssueLink(
  locale: string,
  formData: FormData,
): Promise<IssueLinkResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, issueLinkId: null, error: "unauthorized" };

  const projectId = String(formData.get("projectId") ?? "");
  const issueLinkId = String(formData.get("issueLinkId") ?? "");
  if (projectId.length === 0 || issueLinkId.length === 0) {
    return { ok: false, issueLinkId: null, error: "invalidInput" };
  }

  await prisma.issueLink.deleteMany({ where: { id: issueLinkId, projectId } });
  revalidatePath(`/${locale}/projects/${projectId}/execution`);

  return { ok: true, issueLinkId, error: null };
}

/** Prepares a pre-filled tracker link for a failed execution without creating the link row. */
export async function prepareIssueDraft(
  executionId: string,
  provider: IssueProvider = "GITHUB",
  baseUrl?: string,
): Promise<IssueDraft | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const template = await buildTemplateFromExecution(executionId);
  if (!template) return null;

  return {
    ...template,
    provider,
    url: buildIssueUrl(provider, { ...template, baseUrl }),
  };
}
