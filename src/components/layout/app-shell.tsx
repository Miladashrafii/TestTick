"use client";

import type { Session } from "next-auth";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  ClipboardList,
  PlayCircle,
  Link2,
  BarChart3,
  Users,
  LogOut,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { Brand } from "@/components/brand";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/actions/auth";

function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/\/projects\/([^/]+)/);
  return match?.[1] ?? null;
}

export function AppShell({
  locale,
  session,
  children,
}: {
  locale: string;
  session: Session;
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const projectId = extractProjectId(pathname);
  const isAdmin = session.user.role === "ADMINISTRATOR";

  const mainNav = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/projects", label: t("projects"), icon: FolderKanban },
  ];

  const projectNav = projectId
    ? [
        {
          href: `/projects/${projectId}`,
          label: t("dashboard"),
          icon: LayoutDashboard,
        },
        {
          href: `/projects/${projectId}/suites`,
          label: t("testSpecs"),
          icon: FileText,
        },
        {
          href: `/projects/${projectId}/plans`,
          label: t("testPlans"),
          icon: ClipboardList,
        },
        {
          href: `/projects/${projectId}/execution`,
          label: t("execution"),
          icon: PlayCircle,
        },
        {
          href: `/projects/${projectId}/requirements`,
          label: t("requirements"),
          icon: Link2,
        },
        {
          href: `/projects/${projectId}/reports`,
          label: t("reports"),
          icon: BarChart3,
        },
      ]
    : [];

  return (
    <div className="flex min-h-dvh">
      <aside className="glass-panel fixed inset-y-0 start-0 z-30 flex w-60 flex-col border-e border-slate-200/80">
        <div className="flex h-14 items-center border-b border-slate-200/70 px-4">
          <Link href="/dashboard" className="outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 rounded-lg">
            <Brand />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href === "/projects" && pathname.startsWith("/projects"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-teal-700/10 text-teal-800"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" />
                {item.label}
              </Link>
            );
          })}
          {projectNav.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Project
              </div>
              {projectNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-teal-700/10 text-teal-800"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-80" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
          {isAdmin && (
            <Link
              href="/users"
              className={cn(
                "mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/users"
                  ? "bg-teal-700/10 text-teal-800"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900",
              )}
            >
              <Users className="size-4 shrink-0 opacity-80" />
              {t("users")}
            </Link>
          )}
        </nav>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col ps-60">
        <header className="glass-panel sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-slate-200/70 px-6">
          <div className="text-sm text-slate-500 font-secondary truncate">
            {session.user.name}
            <span className="mx-2 text-slate-300">·</span>
            <span className="text-slate-600">{session.user.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <form action={logoutAction.bind(null, locale)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="size-4" />
                {t("logout")}
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
