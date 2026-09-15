import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/api-keys";
import { forbidden, unauthorized } from "@/lib/api/response";

export type ApiActor =
  | { kind: "session"; userId: string; role: Role }
  | { kind: "apiKey"; userId: string; role: Role; projectId: string; keyId: string };

export type ActorResult =
  | { ok: true; actor: ApiActor }
  | { ok: false; response: Response };

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

function toRole(value: string | undefined): Role {
  return value !== undefined && value in Role ? (value as Role) : Role.GUEST;
}

/** Resolves the caller from a Bearer API key first, falling back to the session cookie. */
export async function resolveApiActor(request: Request): Promise<ApiActor | null> {
  const token = bearerToken(request);
  if (token) {
    const identity = await verifyApiKey(token);
    if (!identity) return null;
    return {
      kind: "apiKey",
      userId: identity.ownerId,
      role: identity.ownerRole,
      projectId: identity.projectId,
      keyId: identity.keyId,
    };
  }

  // A malformed or expired session cookie makes next-auth throw; treat that as anonymous.
  try {
    const session = await auth();
    if (!session?.user?.id) return null;
    return { kind: "session", userId: session.user.id, role: toRole(session.user.role) };
  } catch {
    return null;
  }
}

export async function canAccessProject(actor: ApiActor, projectId: string): Promise<boolean> {
  if (actor.kind === "apiKey") return actor.projectId === projectId;
  if (actor.role === Role.ADMINISTRATOR) return true;

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: actor.userId, projectId } },
    select: { id: true },
  });
  return membership !== null;
}

export async function requireActor(request: Request): Promise<ActorResult> {
  const actor = await resolveApiActor(request);
  if (!actor) return { ok: false, response: unauthorized() };
  return { ok: true, actor };
}

export async function requireProjectActor(
  request: Request,
  projectId: string,
): Promise<ActorResult> {
  const result = await requireActor(request);
  if (!result.ok) return result;
  if (!(await canAccessProject(result.actor, projectId))) {
    return { ok: false, response: forbidden() };
  }
  return result;
}

/**
 * Some operations (creating projects, writing comments) need a real signed-in user rather than a
 * project-scoped machine token.
 */
export function requireSessionActor(actor: ApiActor): ActorResult {
  if (actor.kind !== "session") {
    return { ok: false, response: forbidden("This endpoint requires a user session") };
  }
  return { ok: true, actor };
}
