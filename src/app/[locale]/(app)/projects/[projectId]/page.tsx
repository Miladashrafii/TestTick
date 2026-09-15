import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  Activity,
  BarChart3,
  ClipboardList,
  Compass,
  FileText,
  Link2,
  PlayCircle,
  Settings,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { getFlakyReport } from "@/lib/analytics/flaky";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("projects");
  const tNav = await getTranslations("nav");
  const tInsights = await getTranslations("insights");
  const tActivity = await getTranslations("activity");
  const tExploratory = await getTranslations("exploratory");
  const tSettings = await getTranslations("settings");

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: { cases: true, plans: true, suites: true, requirements: true },
      },
    },
  });
  if (!project) notFound();

  const [report, activeSessions, recentActivity] = await Promise.all([
    getFlakyReport(projectId),
    prisma.exploratorySession.count({ where: { projectId, status: "active" } }),
    prisma.activity.count({ where: { projectId } }),
  ]);

  const links = [
    {
      href: `/projects/${projectId}/suites`,
      label: tNav("testSpecs"),
      desc: t("suitesAndCases", {
        suites: project._count.suites,
        cases: project._count.cases,
      }),
      icon: FileText,
    },
    {
      href: `/projects/${projectId}/plans`,
      label: tNav("testPlans"),
      desc: t("planCount", { count: project._count.plans }),
      icon: ClipboardList,
    },
    {
      href: `/projects/${projectId}/execution`,
      label: tNav("execution"),
      desc: tNav("executionTeaser"),
      icon: PlayCircle,
    },
    {
      href: `/projects/${projectId}/exploratory`,
      label: tNav("exploratory"),
      desc: tExploratory("activeCount", { count: activeSessions }),
      icon: Compass,
    },
    {
      href: `/projects/${projectId}/requirements`,
      label: tNav("requirements"),
      desc: t("requirementCount", { count: project._count.requirements }),
      icon: Link2,
    },
    {
      href: `/projects/${projectId}/reports`,
      label: tNav("insights"),
      desc: tInsights("teaser", {
        flaky: report.flaky.length,
        regressions: report.regressions.length,
      }),
      icon: BarChart3,
      highlight: report.flaky.length > 0 || report.regressions.length > 0,
    },
    {
      href: `/projects/${projectId}/activity`,
      label: tNav("activity"),
      desc: tActivity("entryCount", { count: recentActivity }),
      icon: Activity,
    },
    {
      href: `/projects/${projectId}/settings`,
      label: tNav("settings"),
      desc: tSettings("teaser"),
      icon: Settings,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {project.name}
          </h1>
          <Badge variant="secondary">{project.prefix}</Badge>
          {report.flaky.length > 0 && (
            <Badge variant="warning">
              {tInsights("flakyBadge", { count: report.flaky.length })}
            </Badge>
          )}
        </div>
        <p className="mt-2 max-w-2xl font-secondary text-slate-600">
          {project.description || "—"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card
                className={
                  item.highlight
                    ? "h-full border-amber-200 transition-shadow hover:shadow-md"
                    : "h-full transition-shadow hover:shadow-md"
                }
              >
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-teal-700/10 text-teal-700">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{item.label}</CardTitle>
                    <p className="mt-1 font-secondary text-sm text-slate-500">
                      {item.desc}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="text-sm font-medium text-teal-700">
                    {t("openArea")} →
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
