"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { THEMES, toTheme, type Theme } from "@/lib/theme";

export interface SettingsResult {
  ok: boolean;
  error: string | null;
}

const themeSchema = z.object({
  theme: z.enum(THEMES),
});

const preferencesSchema = z.object({
  theme: z.enum(THEMES),
  locale: z.enum(["en", "fa"]),
});

export async function updateTheme(locale: string, formData: FormData): Promise<SettingsResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const parsed = themeSchema.safeParse({ theme: formData.get("theme") });
  if (!parsed.success) return { ok: false, error: "invalidInput" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme: parsed.data.theme },
  });

  revalidatePath(`/${locale}`, "layout");
  return { ok: true, error: null };
}

/** Theme and locale live on the user row so the choice follows them across devices. */
export async function updatePreferences(
  currentLocale: string,
  formData: FormData,
): Promise<SettingsResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const parsed = preferencesSchema.safeParse({
    theme: formData.get("theme"),
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { ok: false, error: "invalidInput" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme: parsed.data.theme, locale: parsed.data.locale },
  });

  revalidatePath(`/${currentLocale}`, "layout");
  if (parsed.data.locale !== currentLocale) revalidatePath(`/${parsed.data.locale}`, "layout");

  return { ok: true, error: null };
}

export async function getUserTheme(): Promise<Theme> {
  const session = await auth();
  if (!session?.user?.id) return toTheme(null);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { theme: true },
  });
  return toTheme(user?.theme);
}
