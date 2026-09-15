import { getTranslations } from "next-intl/server";
import { ExecutionStatus, ProjectStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { Link } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { caseExternalId, statusColor, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  FileText,
  ClipboardList,
  TrendingUp,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const t = await getTranslations("dashboard");

  const [projectCount, caseCount, planCount, executions, recentExecutions] =
    await Promise.all([
      prisma.testProject.count({ where: { status: ProjectStatus.ACTIVE } }),
      prisma.testCase.count(),
      prisma.testPlan.count({ where: { active: true } }),
      prisma.execution.findMany({ select: { status: true } }),
      prisma.execution.findMany({
        take: 8,
        orderBy: { executedAt: "desc" },
        include: {
          planCase: {
            include: {
              case: { include: { project: true } },
            },
          },
          build: true,
          executor: true,
        },
      }),
    ]);

  const total = executions.length;
  const passed = executions.filter((e) => e.status === ExecutionStatus.PASSED).length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const stats = [
    {
      label: t("projects"),
      value: projectCount,
      icon: FolderKanban,
    },
    {
      label: t("cases"),
      value: caseCount,
      icon: FileText,
    },
    {
      label: t("plans"),
      value: planCount,
      icon: ClipboardList,
    },
    {
      label: t("passRate"),
      value: `${passRate}%`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-slate-600 font-secondary">
          {t("welcome", { name: session?.user?.name ?? "" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 pt-5">
                <div className="flex size-11 items-center justify-center rounded-lg bg-teal-700/10 text-teal-700">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-slate-900">
                    {stat.value}
                  </p>
                  <p className="text-sm text-slate-600">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <Card>
          <CardHeader>
            <CardTitle>{t("recentExecutions")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentExecutions.length === 0 ? (
              <p className="text-sm text-slate-500">{t("noData")}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentExecutions.map((ex) => {
                  const c = ex.planCase.case;
                  const extId = caseExternalId(c.project.prefix, c.externalId);
                  return (
                    <li
                      key={ex.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/projects/${c.projectId}/cases/${c.id}`}
                          className="font-medium text-slate-900 hover:text-teal-700"
                        >
                          {extId} — {c.title}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {ex.build.name}
                          {ex.executor ? ` · ${ex.executor.name}` : ""}
                          {" · "}
                          {formatDistanceToNow(ex.executedAt, { addSuffix: true })}
                        </p>
                      </div>
                      <Badge
                        className={cn("border", statusColor(ex.status))}
                        variant="outline"
                      >
                        {ex.status.replace("_", " ")}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit lg:min-w-[220px]">
          <CardHeader>
            <CardTitle>{t("quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="secondary" className="justify-start">
              <Link href="/projects">{t("newProject")}</Link>
            </Button>
            <Button asChild variant="secondary" className="justify-start">
              <Link href="/projects">{t("runTests")}</Link>
            </Button>
            <Button asChild variant="secondary" className="justify-start">
              <Link href="/projects">{t("viewReports")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
