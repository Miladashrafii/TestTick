import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExecutionStatus, Importance } from "@prisma/client";
import { AlertTriangle, Repeat, TrendingDown } from "lucide-react";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { getFlakyReport } from "@/lib/analytics/flaky";
import { isolate } from "@/lib/bidi";
import { caseExternalId, cn, statusColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function percent(value: number) {
  return Math.round(value * 100);
}

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("reports");
  const tInsights = await getTranslations("insights");
  const tCommon = await getTranslations("common");

  const project = await prisma.testProject.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  const [executions, importanceGroups, reqCount, coveredReqs, report] =
    await Promise.all([
      prisma.execution.findMany({
        where: { planCase: { plan: { projectId } } },
        select: { status: true },
      }),
      prisma.testCase.groupBy({
        by: ["importance"],
        where: { projectId },
        _count: true,
      }),
      prisma.requirement.count({ where: { projectId } }),
      prisma.requirement.count({
        where: { projectId, coverage: { some: {} } },
      }),
      getFlakyReport(projectId),
    ]);

  const statusCounts: Record<ExecutionStatus, number> = {
    NOT_RUN: 0,
    PASSED: 0,
    FAILED: 0,
    BLOCKED: 0,
    SKIPPED: 0,
  };
  for (const execution of executions) {
    statusCounts[execution.status] += 1;
  }

  const totalExec = executions.length;
  const maxStatus = Math.max(...Object.values(statusCounts), 1);

  const importanceMap = Object.fromEntries(
    importanceGroups.map((group) => [group.importance, group._count]),
  ) as Record<Importance, number>;

  const coveragePct =
    reqCount > 0 ? Math.round((coveredReqs / reqCount) * 100) : 0;

  const statusLabels: { key: ExecutionStatus; label: string; color: string }[] = [
    { key: ExecutionStatus.PASSED, label: t("passed"), color: "bg-emerald-500" },
    { key: ExecutionStatus.FAILED, label: t("failed"), color: "bg-rose-500" },
    { key: ExecutionStatus.BLOCKED, label: t("blocked"), color: "bg-amber-500" },
    { key: ExecutionStatus.SKIPPED, label: t("skipped"), color: "bg-slate-400" },
    { key: ExecutionStatus.NOT_RUN, label: t("notRun"), color: "bg-sky-400" },
  ];

  const summaryCards = [
    { label: t("totalExecutions"), value: totalExec, tone: "text-slate-900" },
    {
      label: tInsights("flakyCount"),
      value: report.flaky.length,
      tone: report.flaky.length > 0 ? "text-amber-700" : "text-slate-900",
    },
    {
      label: tInsights("regressionCount"),
      value: report.regressions.length,
      tone: report.regressions.length > 0 ? "text-rose-700" : "text-slate-900",
    },
    { label: t("coverage"), value: `${coveragePct}%`, tone: "text-teal-700" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {tInsights("title")}
        </h1>
        <p className="mt-1 font-secondary text-slate-600">
          {project.name} · {tInsights("subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="py-4">
              <p className={cn("text-3xl font-semibold tabular-nums", card.tone)}>
                {card.value}
              </p>
              <p className="mt-1 font-secondary text-xs text-slate-500">
                {card.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tInsights("passRateByBuild")}</CardTitle>
          <p className="font-secondary text-sm text-slate-500">
            {tInsights("passRateHint")}
          </p>
        </CardHeader>
        <CardContent>
          {report.trend.length === 0 ? (
            <p className="text-sm text-slate-500">{tInsights("noBuilds")}</p>
          ) : (
            <ul className="space-y-3">
              {report.trend.map((point) => (
                <li key={point.buildId} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span
                      dir="ltr"
                      className="truncate font-medium text-slate-700"
                    >
                      {point.buildName}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-600">
                      {percent(point.passRate)}%
                      <span className="ms-2 text-xs text-slate-400">
                        {point.passed}/{point.total}
                      </span>
                    </span>
                  </div>
                  <div
                    className="flex h-2.5 overflow-hidden rounded-full bg-slate-100"
                    role="img"
                    aria-label={tInsights("buildBarLabel", {
                      build: isolate(point.buildName),
                      rate: percent(point.passRate),
                    })}
                  >
                    <span
                      className="bg-emerald-500"
                      style={{ width: `${(point.passed / (point.total || 1)) * 100}%` }}
                    />
                    <span
                      className="bg-rose-500"
                      style={{ width: `${(point.failed / (point.total || 1)) * 100}%` }}
                    />
                    <span
                      className="bg-amber-500"
                      style={{ width: `${(point.blocked / (point.total || 1)) * 100}%` }}
                    />
                    <span
                      className="bg-slate-400"
                      style={{ width: `${(point.skipped / (point.total || 1)) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Repeat className="size-4 text-amber-600" aria-hidden />
              {tInsights("flakyCases")}
            </CardTitle>
            <p className="font-secondary text-sm text-slate-500">
              {tInsights("flakyHint", { sample: report.sampleSize })}
            </p>
          </CardHeader>
          <CardContent>
            {report.flaky.length === 0 ? (
              <p className="text-sm text-slate-500">{tInsights("noFlaky")}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {report.flaky.slice(0, 10).map((flaky) => (
                  <li key={flaky.caseId} className="py-2.5 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/projects/${projectId}/cases/${flaky.caseId}`}
                        className="min-w-0 truncate text-sm font-medium text-slate-900 hover:text-teal-700"
                      >
                        {caseExternalId(project.prefix, flaky.externalId)} —{" "}
                        {flaky.title}
                      </Link>
                      <Badge variant="warning">
                        {tInsights("flips", { count: flaky.flips })}
                      </Badge>
                    </div>
                    <p className="mt-0.5 font-secondary text-xs text-slate-500">
                      {tInsights("flakyMeta", {
                        failures: flaky.failed,
                        runs: flaky.total,
                        rate: percent(flaky.failureRate),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="size-4 text-rose-600" aria-hidden />
              {tInsights("regressions")}
            </CardTitle>
            <p className="font-secondary text-sm text-slate-500">
              {report.latestBuild && report.previousBuild
                ? tInsights("regressionHint", {
                    latest: isolate(report.latestBuild.buildName),
                    previous: isolate(report.previousBuild.buildName),
                  })
                : tInsights("regressionHintNoBuilds")}
            </p>
          </CardHeader>
          <CardContent>
            {report.regressions.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <AlertTriangle className="size-4 opacity-50" aria-hidden />
                {tInsights("noRegressions")}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {report.regressions.slice(0, 10).map((regression) => (
                  <li key={regression.caseId} className="py-2.5 first:pt-0">
                    <Link
                      href={`/projects/${projectId}/cases/${regression.caseId}`}
                      className="block truncate text-sm font-medium text-slate-900 hover:text-teal-700"
                    >
                      {caseExternalId(project.prefix, regression.externalId)} —{" "}
                      {regression.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-1.5 text-xs">
                      <Badge
                        variant="outline"
                        className={cn("border", statusColor(regression.previousStatus))}
                      >
                        {regression.previousStatus}
                      </Badge>
                      <span className="text-slate-400">→</span>
                      <Badge
                        variant="outline"
                        className={cn("border", statusColor(regression.latestStatus))}
                      >
                        {regression.latestStatus}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("byStatus")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {statusLabels.map(({ key, label, color }) => (
            <div key={key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">{label}</span>
                <span className="tabular-nums text-slate-600">
                  {statusCounts[key]}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${(statusCounts[key] / maxStatus) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("byImportance")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {Object.values(Importance).map((importance) => (
            <div
              key={importance}
              className="rounded-lg border border-slate-200/80 bg-white/50 px-4 py-3 text-center"
            >
              <p className="text-2xl font-semibold tabular-nums text-slate-900">
                {importanceMap[importance] ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-500">{importance}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("coverage")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <span className="text-4xl font-semibold tabular-nums text-teal-700">
              {coveragePct}%
            </span>
            <p className="pb-1 font-secondary text-sm text-slate-600">
              {coveredReqs} {tCommon("of")} {reqCount} {t("requirementsLinked")}
            </p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-600"
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
