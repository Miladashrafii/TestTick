"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { draftTestCase, type DraftedTestCase } from "@/lib/ai/draft-case";

export interface DraftCaseState {
  ok: boolean;
  draft: DraftedTestCase | null;
  error: string | null;
}

const draftSchema = z.object({
  prompt: z.string().min(8).max(2000),
  locale: z.string().optional(),
});

export async function draftCaseAction(
  locale: string,
  formData: FormData,
): Promise<DraftCaseState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, draft: null, error: "unauthorized" };
  }

  const parsed = draftSchema.safeParse({
    prompt: formData.get("prompt"),
    locale: formData.get("locale") ?? locale,
  });
  if (!parsed.success) {
    return { ok: false, draft: null, error: "invalidPrompt" };
  }

  const draft = await draftTestCase({
    prompt: parsed.data.prompt,
    locale: parsed.data.locale ?? locale,
  });

  return { ok: true, draft, error: null };
}
