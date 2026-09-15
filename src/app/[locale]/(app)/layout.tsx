import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { AppShell } from "@/components/layout/app-shell";

export default async function AuthenticatedLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const session = await auth();
  if (!session) {
    redirect({ href: "/login", locale });
  }

  return (
    <AppShell locale={locale} session={session!}>
      {children}
    </AppShell>
  );
}
