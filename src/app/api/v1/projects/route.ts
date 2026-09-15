import type { NextRequest } from "next/server";
import { ProjectStatus, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireActor, requireSessionActor } from "@/lib/api/actor";
import { badRequest, jsonCreated, jsonOk } from "@/lib/api/response";
import { listResponse, readPagination } from "@/lib/api/query";
import { serializeProject } from "@/lib/api/serializers";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  prefix: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Z0-9]+$/, "prefix must be uppercase letters or digits"),
  description: z.string().max(2000).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await requireActor(request);
  if (!auth.ok) return auth.response;

  const { actor } = auth;
  const page = readPagination(request.nextUrl.searchParams);

  const where =
    actor.kind === "apiKey"
      ? { id: actor.projectId }
      : actor.role === Role.ADMINISTRATOR
        ? {}
        : { members: { some: { userId: actor.userId } } };

  const [projects, total] = await Promise.all([
    prisma.testProject.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page.offset,
      take: page.limit,
      include: {
        _count: { select: { cases: true, plans: true, suites: true, requirements: true } },
      },
    }),
    prisma.testProject.count({ where }),
  ]);

  const items = projects.map((project) =>
    serializeProject(project, {
      cases: project._count.cases,
      plans: project._count.plans,
      suites: project._count.suites,
      requirements: project._count.requirements,
    }),
  );

  return jsonOk(listResponse(items, total, page));
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireActor(request);
  if (!auth.ok) return auth.response;

  const sessionOnly = requireSessionActor(auth.actor);
  if (!sessionOnly.ok) return sessionOnly.response;

  const payload: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest("Invalid project payload", z.flattenError(parsed.error));
  }

  const role =
    sessionOnly.actor.role === Role.ADMINISTRATOR ? Role.ADMINISTRATOR : Role.LEADER;

  const project = await prisma.testProject.create({
    data: {
      name: parsed.data.name,
      prefix: parsed.data.prefix,
      description: parsed.data.description ?? "",
      status: ProjectStatus.ACTIVE,
      members: { create: { userId: sessionOnly.actor.userId, role } },
    },
  });

  return jsonCreated(serializeProject(project));
}
