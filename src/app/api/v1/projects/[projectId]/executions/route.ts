import type { NextRequest } from "next/server";
import { ExecutionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectActor } from "@/lib/api/actor";
import { jsonOk } from "@/lib/api/response";
import { listResponse, readEnum, readPagination, readString } from "@/lib/api/query";
import { serializeExecution } from "@/lib/api/serializers";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await context.params;
  const auth = await requireProjectActor(request, projectId);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const page = readPagination(params);
  const planId = readString(params, "planId");
  const buildId = readString(params, "buildId");
  const caseId = readString(params, "caseId");
  const source = readString(params, "source");
  const status = readEnum(params, "status", Object.values(ExecutionStatus));

  const where: Prisma.ExecutionWhereInput = {
    planCase: {
      plan: { projectId, ...(planId ? { id: planId } : {}) },
      ...(caseId ? { caseId } : {}),
    },
    ...(buildId ? { buildId } : {}),
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
  };

  const [executions, total] = await Promise.all([
    prisma.execution.findMany({
      where,
      orderBy: { executedAt: "desc" },
      skip: page.offset,
      take: page.limit,
      include: {
        build: { select: { id: true, name: true, planId: true } },
        platform: { select: { name: true } },
        executor: { select: { name: true } },
        planCase: {
          select: { caseId: true, case: { select: { externalId: true, title: true } } },
        },
      },
    }),
    prisma.execution.count({ where }),
  ]);

  return jsonOk(listResponse(executions.map(serializeExecution), total, page));
}
