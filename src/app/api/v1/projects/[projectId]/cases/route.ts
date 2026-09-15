import type { NextRequest } from "next/server";
import { ExecutionType, Importance, Prisma, ReviewStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectActor } from "@/lib/api/actor";
import { badRequest, jsonCreated, jsonOk, notFound } from "@/lib/api/response";
import { listResponse, readEnum, readPagination, readString } from "@/lib/api/query";
import { serializeTestCase } from "@/lib/api/serializers";

const createSchema = z.object({
  suiteId: z.string().min(1),
  title: z.string().min(1).max(300),
  summary: z.string().max(5000).optional(),
  preconditions: z.string().max(5000).optional(),
  steps: z.string().max(10_000).optional(),
  expectedResult: z.string().max(5000).optional(),
  importance: z.enum(Importance).optional(),
  executionType: z.enum(ExecutionType).optional(),
  reviewStatus: z.enum(ReviewStatus).optional(),
  automationKey: z.string().max(300).nullish(),
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
  const search = readString(params, "q");
  const suiteId = readString(params, "suiteId");
  const automationKey = readString(params, "automationKey");
  const reviewStatus = readEnum(params, "reviewStatus", Object.values(ReviewStatus));
  const importance = readEnum(params, "importance", Object.values(Importance));
  const executionType = readEnum(params, "executionType", Object.values(ExecutionType));

  const where: Prisma.TestCaseWhereInput = {
    projectId,
    ...(suiteId ? { suiteId } : {}),
    ...(automationKey ? { automationKey } : {}),
    ...(reviewStatus ? { reviewStatus } : {}),
    ...(importance ? { importance } : {}),
    ...(executionType ? { executionType } : {}),
    ...(search ? { OR: [{ title: { contains: search } }, { summary: { contains: search } }] } : {}),
  };

  const [project, cases, total] = await Promise.all([
    prisma.testProject.findUnique({ where: { id: projectId }, select: { prefix: true } }),
    prisma.testCase.findMany({
      where,
      orderBy: { externalId: "asc" },
      skip: page.offset,
      take: page.limit,
      include: { suite: { select: { name: true } } },
    }),
    prisma.testCase.count({ where }),
  ]);
  if (!project) return notFound("Project not found");

  const items = cases.map((testCase) =>
    serializeTestCase(testCase, {
      suiteName: testCase.suite.name,
      projectPrefix: project.prefix,
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
    return badRequest("Invalid test case payload", z.flattenError(parsed.error));
  }

  const suite = await prisma.testSuite.findFirst({
    where: { id: parsed.data.suiteId, projectId },
    select: { id: true, name: true },
  });
  if (!suite) return badRequest("suiteId does not belong to this project");

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    select: { prefix: true },
  });
  if (!project) return notFound("Project not found");

  const highest = await prisma.testCase.aggregate({
    where: { projectId },
    _max: { externalId: true },
  });

  const testCase = await prisma.testCase.create({
    data: {
      projectId,
      suiteId: suite.id,
      externalId: (highest._max.externalId ?? 0) + 1,
      title: parsed.data.title,
      summary: parsed.data.summary ?? "",
      preconditions: parsed.data.preconditions ?? "",
      steps: parsed.data.steps ?? "",
      expectedResult: parsed.data.expectedResult ?? "",
      importance: parsed.data.importance ?? Importance.MEDIUM,
      executionType: parsed.data.executionType ?? ExecutionType.MANUAL,
      reviewStatus: parsed.data.reviewStatus ?? ReviewStatus.DRAFT,
      automationKey: parsed.data.automationKey ?? null,
      authorId: auth.actor.userId,
    },
  });

  return jsonCreated(
    serializeTestCase(testCase, { suiteName: suite.name, projectPrefix: project.prefix }),
  );
}
