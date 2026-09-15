"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordActivity, type ActivityTarget } from "@/lib/activity";
import { findMentionedUserIds } from "@/lib/mentions";

export interface CommentResult {
  ok: boolean;
  activityId: string | null;
  mentionedUserIds: string[];
  error: string | null;
}

const targetSchema = z.object({
  caseId: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  executionId: z.string().min(1).optional(),
  requirementId: z.string().min(1).optional(),
});

const commentSchema = z.object({
  projectId: z.string().min(1),
  body: z.string().min(1).max(5000),
});

export async function addComment(
  projectId: string,
  body: string,
  target: ActivityTarget = {},
  locale = "en",
): Promise<CommentResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, activityId: null, mentionedUserIds: [], error: "unauthorized" };
  }

  const parsed = commentSchema.safeParse({ projectId, body });
  const parsedTarget = targetSchema.safeParse({
    caseId: target.caseId ?? undefined,
    planId: target.planId ?? undefined,
    executionId: target.executionId ?? undefined,
    requirementId: target.requirementId ?? undefined,
  });
  if (!parsed.success || !parsedTarget.success) {
    return { ok: false, activityId: null, mentionedUserIds: [], error: "invalidInput" };
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId: parsed.data.projectId },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  const mentionedUserIds = findMentionedUserIds(
    parsed.data.body,
    members.map((member) => member.user),
  );

  const activityId = await recordActivity({
    projectId: parsed.data.projectId,
    authorId: session.user.id,
    type: "COMMENT",
    body: parsed.data.body,
    target: parsedTarget.data,
    mentionUserIds: mentionedUserIds,
  });

  revalidateTargets(locale, parsed.data.projectId, parsedTarget.data);

  return { ok: true, activityId, mentionedUserIds, error: null };
}

export async function addCommentAction(
  locale: string,
  formData: FormData,
): Promise<CommentResult> {
  const readOptional = (key: string): string | undefined => {
    const value = formData.get(key);
    return typeof value === "string" && value.length > 0 ? value : undefined;
  };

  return addComment(
    String(formData.get("projectId") ?? ""),
    String(formData.get("body") ?? ""),
    {
      caseId: readOptional("caseId"),
      planId: readOptional("planId"),
      executionId: readOptional("executionId"),
      requirementId: readOptional("requirementId"),
    },
    locale,
  );
}

export async function markMentionRead(mentionId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.mention.updateMany({
    where: { id: mentionId, userId: session.user.id },
    data: { read: true },
  });
}

export async function markAllMentionsRead(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.mention.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });
}

function revalidateTargets(locale: string, projectId: string, target: ActivityTarget): void {
  const base = `/${locale}/projects/${projectId}`;
  if (target.caseId) revalidatePath(`${base}/cases/${target.caseId}`);
  if (target.planId) revalidatePath(`${base}/plans/${target.planId}`);
  if (target.executionId) revalidatePath(`${base}/execution`);
  if (target.requirementId) revalidatePath(`${base}/requirements`);
  revalidatePath(base);
}
