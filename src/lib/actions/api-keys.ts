"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageProject } from "@/lib/authz";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";

/** Fields are optional so the UI can seed `useActionState` with an empty object. */
export interface CreateApiKeyState {
  ok?: boolean;
  /** Plaintext key. Shown once, never retrievable afterwards. */
  plaintext?: string;
  keyPrefix?: string;
  error?: string;
}

export interface RevokeApiKeyState {
  ok?: boolean;
  error?: string;
}

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
});

export async function createApiKeyAction(
  locale: string,
  formData: FormData,
): Promise<CreateApiKeyState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const parsed = createSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return { ok: false, error: "invalidInput" };

  if (!(await canManageProject(session.user.id, parsed.data.projectId, session.user.role))) {
    return { ok: false, error: "forbidden" };
  }

  const created = await createApiKey(parsed.data.projectId, parsed.data.name, session.user.id);
  revalidatePath(`/${locale}/projects/${parsed.data.projectId}/settings`);

  return { ok: true, plaintext: created.token, keyPrefix: created.keyPrefix };
}

export async function revokeApiKeyAction(
  locale: string,
  formData: FormData,
): Promise<RevokeApiKeyState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const projectId = String(formData.get("projectId") ?? "");
  const keyId = String(formData.get("keyId") ?? "");
  if (projectId.length === 0 || keyId.length === 0) return { ok: false, error: "invalidInput" };

  if (!(await canManageProject(session.user.id, projectId, session.user.role))) {
    return { ok: false, error: "forbidden" };
  }

  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, projectId },
    select: { id: true },
  });
  if (!key) return { ok: false, error: "notFound" };

  await revokeApiKey(key.id);
  revalidatePath(`/${locale}/projects/${projectId}/settings`);

  return { ok: true };
}
