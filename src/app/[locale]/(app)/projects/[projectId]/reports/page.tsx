import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExecutionStatus, Importance } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("reports");
  const tCommon = await getTranslations("common");

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
  });
  if (!project) notFound();

  const [executions, importanceGroups, reqCount, coveredReqs] = await Promise.all([
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
      where: {
        projectId,
        coverage: { some: {} },
      },
    }),
  ]);

  const statusCounts: Record<ExecutionStatus, number> = {
    NOT_RUN: 0,
    PASSED: 0,
    FAILED: 0,
    BLOCKED: 0,
    SKIPPED: 0,
  };
  for (const ex of executions) {
    statusCounts[ex.status]++;
  }

  const totalExec = executions.length;
  const maxStatus = Math.max(...Object.values(statusCounts), 1);

  const importanceMap = Object.fromEntries(
    importanceGroups.map((g) => [g.importance, g._count]),
  ) as Record<Importance, number>;

  const coveragePct =
    reqCount > 0 ? Math.round((coveredReqs / reqCount) * 100) : 0;

  const statusLabels: { key: ExecutionStatus; label: string; color: string }[] = [
    { key: ExecutionStatus.PASSED, label: t("passed"), color: "bg-emerald-500" },
    { key: ExecutionStatus.FAILED, label: t("failed"), color: "bg-rose-500" },
    { key: ExecutionStatus.BLOCKED, label: t("blocked"), color: "bg-amber-500" },
    { key: ExecutionStatus.SKIPPED, label: "Skipped", color: "bg-slate-400" },
    { key: ExecutionStatus.NOT_RUN, label: t("notRun"), color: "bg-sky-400" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-slate-600 font-secondary">
          {project.name} · {t("subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("totalExecutions")}: {totalExec}
          </CardTitle>
        </CardHeader>
      </Card>

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
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{
                    width: `${(statusCounts[key] / maxStatus) * 100}%`,
                  }}
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
          {Object.values(Importance).map((imp) => (
            <div
              key={imp}
              className="rounded-lg border border-slate-200/80 bg-white/50 px-4 py-3 text-center"
            >
              <p className="text-2xl font-semibold tabular-nums text-slate-900">
                {importanceMap[imp] ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">{imp}</p>
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
            <p className="text-sm text-slate-600 pb-1 font-secondary">
              {coveredReqs} {tCommon("of")} {reqCount} requirements linked to cases
            </p>
          </div>
          <div className="mt-4 h-3 rounded-full bg-slate-100 overflow-hidden">
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
