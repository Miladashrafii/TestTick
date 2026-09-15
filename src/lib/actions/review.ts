"use server";

import { revalidatePath } from "next/cache";
import type { ReviewStatus } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity";
import { REVIEW_STATUSES } from "@/lib/enums";

export interface ReviewResult {
  ok: boolean;
  reviewStatus: ReviewStatus | null;
  error: string | null;
}

const caseSchema = z.object({
  projectId: z.string().min(1),
  caseId: z.string().min(1),
  reviewStatus: z.enum(REVIEW_STATUSES),
  comment: z.string().max(2000).optional(),
});

const planSchema = z.object({
  projectId: z.string().min(1),
  planId: z.string().min(1),
  reviewStatus: z.enum(REVIEW_STATUSES),
  comment: z.string().max(2000).optional(),
});

/** Approving or rejecting stamps the acting user as reviewer; drafting clears it. */
function reviewerFor(status: ReviewStatus, userId: string): string | null {
  return status === "DRAFT" ? null : userId;
}

function statusChangeBody(from: ReviewStatus, to: ReviewStatus, comment?: string): string {
  const headline = `Review status changed from ${from} to ${to}`;
  return comment && comment.trim().length > 0 ? `${headline}\n${comment.trim()}` : headline;
}

export async function setCaseReviewStatus(
  locale: string,
  formData: FormData,
): Promise<ReviewResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reviewStatus: null, error: "unauthorized" };

  const parsed = caseSchema.safeParse({
    projectId: formData.get("projectId"),
    caseId: formData.get("caseId"),
    reviewStatus: formData.get("reviewStatus"),
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) return { ok: false, reviewStatus: null, error: "invalidInput" };

  const current = await prisma.testCase.findFirst({
    where: { id: parsed.data.caseId, projectId: parsed.data.projectId },
    select: { reviewStatus: true },
  });
  if (!current) return { ok: false, reviewStatus: null, error: "notFound" };

  await prisma.testCase.update({
    where: { id: parsed.data.caseId },
    data: {
      reviewStatus: parsed.data.reviewStatus,
      reviewerId: reviewerFor(parsed.data.reviewStatus, session.user.id),
    },
  });

  await recordActivity({
    projectId: parsed.data.projectId,
    authorId: session.user.id,
    type: "STATUS_CHANGE",
    body: statusChangeBody(current.reviewStatus, parsed.data.reviewStatus, parsed.data.comment),
    target: { caseId: parsed.data.caseId },
  });

  const base = `/${locale}/projects/${parsed.data.projectId}`;
  revalidatePath(`${base}/cases/${parsed.data.caseId}`);
  revalidatePath(`${base}/suites`);

  return { ok: true, reviewStatus: parsed.data.reviewStatus, error: null };
}

export async function setPlanReviewStatus(
  locale: string,
  formData: FormData,
): Promise<ReviewResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reviewStatus: null, error: "unauthorized" };

  const parsed = planSchema.safeParse({
    projectId: formData.get("projectId"),
    planId: formData.get("planId"),
    reviewStatus: formData.get("reviewStatus"),
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) return { ok: false, reviewStatus: null, error: "invalidInput" };

  const current = await prisma.testPlan.findFirst({
    where: { id: parsed.data.planId, projectId: parsed.data.projectId },
    select: { reviewStatus: true },
  });
  if (!current) return { ok: false, reviewStatus: null, error: "notFound" };

  await prisma.testPlan.update({
    where: { id: parsed.data.planId },
    data: {
      reviewStatus: parsed.data.reviewStatus,
      reviewerId: reviewerFor(parsed.data.reviewStatus, session.user.id),
    },
  });

  await recordActivity({
    projectId: parsed.data.projectId,
    authorId: session.user.id,
    type: "STATUS_CHANGE",
    body: statusChangeBody(current.reviewStatus, parsed.data.reviewStatus, parsed.data.comment),
    target: { planId: parsed.data.planId },
  });

  const base = `/${locale}/projects/${parsed.data.projectId}`;
  revalidatePath(`${base}/plans/${parsed.data.planId}`);
  revalidatePath(`${base}/plans`);

  return { ok: true, reviewStatus: parsed.data.reviewStatus, error: null };
}
