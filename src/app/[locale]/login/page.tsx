import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (session) {
    redirect({ href: "/dashboard", locale });
  }

  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between p-6">
        <Brand showTagline />
        <LocaleSwitcher />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {t("title")}
            </h1>
            <p className="mt-2 text-sm text-slate-600 font-secondary">
              {t("subtitle")}
            </p>
          </div>
          <div className="glass-panel rounded-2xl p-8 shadow-md">
            <LoginForm locale={locale} />
            <p className="mt-6 text-center text-xs text-slate-500 font-secondary">
              {t("demoHint")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
