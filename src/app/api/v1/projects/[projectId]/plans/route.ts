import type { NextRequest } from "next/server";
import { Prisma, ReviewStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectActor } from "@/lib/api/actor";
import { badRequest, jsonCreated, jsonOk } from "@/lib/api/response";
import { listResponse, readEnum, readPagination, readString } from "@/lib/api/query";
import { serializeTestPlan } from "@/lib/api/serializers";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  active: z.boolean().optional(),
  reviewStatus: z.enum(ReviewStatus).optional(),
  builds: z.array(z.string().min(1).max(120)).max(20).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await context.params;
  const auth = await requireProjectActor(request, projectId);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const page = readPagination(params);
  const activeParam = readString(params, "active");
  const reviewStatus = readEnum(params, "reviewStatus", Object.values(ReviewStatus));

  const where: Prisma.TestPlanWhereInput = {
    projectId,
    ...(activeParam === undefined ? {} : { active: activeParam !== "false" }),
    ...(reviewStatus ? { reviewStatus } : {}),
  };

  const [plans, total] = await Promise.all([
    prisma.testPlan.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page.offset,
      take: page.limit,
      include: { _count: { select: { cases: true, builds: true, milestones: true } } },
    }),
    prisma.testPlan.count({ where }),
  ]);

  const items = plans.map((plan) =>
    serializeTestPlan(plan, {
      cases: plan._count.cases,
      builds: plan._count.builds,
      milestones: plan._count.milestones,
    }),
  );

  return jsonOk(listResponse(items, total, page));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await context.params;
  const auth = await requireProjectActor(request, projectId);
  if (!auth.ok) return auth.response;

  const payload: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest("Invalid test plan payload", z.flattenError(parsed.error));
  }

  const plan = await prisma.testPlan.create({
    data: {
      projectId,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      active: parsed.data.active ?? true,
      reviewStatus: parsed.data.reviewStatus ?? ReviewStatus.DRAFT,
      authorId: auth.actor.userId,
      ...(parsed.data.builds && parsed.data.builds.length > 0
        ? { builds: { create: parsed.data.builds.map((name) => ({ name })) } }
        : {}),
    },
    include: { _count: { select: { cases: true, builds: true, milestones: true } } },
  });

  return jsonCreated(
    serializeTestPlan(plan, {
      cases: plan._count.cases,
      builds: plan._count.builds,
      milestones: plan._count.milestones,
    }),
  );
}
