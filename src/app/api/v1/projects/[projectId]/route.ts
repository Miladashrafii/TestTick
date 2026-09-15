import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectActor } from "@/lib/api/actor";
import { jsonOk, notFound } from "@/lib/api/response";
import { serializeProject } from "@/lib/api/serializers";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
): Promise<Response> {
  const { projectId } = await context.params;
  const auth = await requireProjectActor(request, projectId);
  if (!auth.ok) return auth.response;

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    include: {
      _count: { select: { cases: true, plans: true, suites: true, requirements: true } },
      platforms: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      suites: {
        select: { id: true, name: true, parentId: true, orderIndex: true },
        orderBy: { orderIndex: "asc" },
      },
      members: {
        select: { role: true, user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!project) return notFound("Project not found");

  return jsonOk({
    ...serializeProject(project, {
      cases: project._count.cases,
      plans: project._count.plans,
      suites: project._count.suites,
      requirements: project._count.requirements,
    }),
    platforms: project.platforms,
    suites: project.suites,
    members: project.members.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    })),
  });
}
