import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Roles allowed to change project-level configuration such as API keys and custom fields. */
const MANAGER_ROLES: ReadonlySet<Role> = new Set([Role.ADMINISTRATOR, Role.LEADER]);

export async function getProjectRole(userId: string, projectId: string): Promise<Role | null> {
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  return (await getProjectRole(userId, projectId)) !== null;
}

export async function canManageProject(
  userId: string,
  projectId: string,
  globalRole?: string,
): Promise<boolean> {
  if (globalRole === Role.ADMINISTRATOR) return true;
  const role = await getProjectRole(userId, projectId);
  return role !== null && MANAGER_ROLES.has(role);
}
