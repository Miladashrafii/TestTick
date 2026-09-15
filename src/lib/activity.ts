import type { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ActivityTarget {
  caseId?: string | null;
  planId?: string | null;
  executionId?: string | null;
  requirementId?: string | null;
}

export interface RecordActivityInput {
  projectId: string;
  authorId: string;
  type: ActivityType;
  body: string;
  target?: ActivityTarget;
  mentionUserIds?: string[];
}

export interface ActivityEntry {
  id: string;
  type: ActivityType;
  body: string;
  createdAt: Date;
  authorName: string;
  authorEmail: string;
  caseId: string | null;
  planId: string | null;
  executionId: string | null;
  requirementId: string | null;
  mentionedUserIds: string[];
}

export async function recordActivity(input: RecordActivityInput): Promise<string> {
  const mentionUserIds = [...new Set(input.mentionUserIds ?? [])].filter(
    (userId) => userId !== input.authorId,
  );

  const activity = await prisma.activity.create({
    data: {
      projectId: input.projectId,
      authorId: input.authorId,
      type: input.type,
      body: input.body,
      caseId: input.target?.caseId ?? null,
      planId: input.target?.planId ?? null,
      executionId: input.target?.executionId ?? null,
      requirementId: input.target?.requirementId ?? null,
      mentions:
        mentionUserIds.length > 0
          ? { create: mentionUserIds.map((userId) => ({ userId })) }
          : undefined,
    },
    select: { id: true },
  });

  return activity.id;
}

export async function listProjectActivity(
  projectId: string,
  options: { limit?: number; target?: ActivityTarget } = {},
): Promise<ActivityEntry[]> {
  const { limit = 30, target } = options;
  const activities = await prisma.activity.findMany({
    where: {
      projectId,
      ...(target?.caseId ? { caseId: target.caseId } : {}),
      ...(target?.planId ? { planId: target.planId } : {}),
      ...(target?.executionId ? { executionId: target.executionId } : {}),
      ...(target?.requirementId ? { requirementId: target.requirementId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    include: {
      author: { select: { name: true, email: true } },
      mentions: { select: { userId: true } },
    },
  });

  return activities.map((activity) => ({
    id: activity.id,
    type: activity.type,
    body: activity.body,
    createdAt: activity.createdAt,
    authorName: activity.author.name,
    authorEmail: activity.author.email,
    caseId: activity.caseId,
    planId: activity.planId,
    executionId: activity.executionId,
    requirementId: activity.requirementId,
    mentionedUserIds: activity.mentions.map((mention) => mention.userId),
  }));
}

export interface MentionInboxItem {
  mentionId: string;
  read: boolean;
  createdAt: Date;
  projectId: string;
  projectName: string;
  body: string;
  authorName: string;
  caseId: string | null;
  planId: string | null;
  executionId: string | null;
  requirementId: string | null;
}

export async function listUserMentions(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<MentionInboxItem[]> {
  const mentions = await prisma.mention.findMany({
    where: { userId, ...(options.unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(options.limit ?? 25, 1), 100),
    include: {
      activity: {
        include: {
          author: { select: { name: true } },
          project: { select: { id: true, name: true } },
        },
      },
    },
  });

  return mentions.map((mention) => ({
    mentionId: mention.id,
    read: mention.read,
    createdAt: mention.createdAt,
    projectId: mention.activity.project.id,
    projectName: mention.activity.project.name,
    body: mention.activity.body,
    authorName: mention.activity.author.name,
    caseId: mention.activity.caseId,
    planId: mention.activity.planId,
    executionId: mention.activity.executionId,
    requirementId: mention.activity.requirementId,
  }));
}
