import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExecutionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { caseExternalId, statusColor, cn } from "@/lib/utils";
import { recordExecution } from "@/lib/actions/executions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExecutionFilters } from "@/components/execution/execution-filters";

export default async function ExecutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams: Promise<{ plan?: string; build?: string; platform?: string }>;
}) {
  const { locale, projectId } = await params;
  const sp = await searchParams;
  const t = await getTranslations("execution");

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
  });
  if (!project) notFound();

  const plans = await prisma.testPlan.findMany({
    where: { projectId, active: true },
    include: {
      builds: { where: { isOpen: true }, orderBy: { createdAt: "desc" } },
      platforms: { include: { platform: true } },
    },
    orderBy: { name: "asc" },
  });

  const planId =
    sp.plan && plans.some((p) => p.id === sp.plan) ? sp.plan : plans[0]?.id;
  const plan = plans.find((p) => p.id === planId);

  const buildId =
    sp.build && plan?.builds.some((b) => b.id === sp.build)
      ? sp.build
      : plan?.builds[0]?.id;

  const platformId =
    sp.platform && plan?.platforms.some((pp) => pp.platformId === sp.platform)
      ? sp.platform
      : undefined;

  const planCases =
    planId && buildId
      ? await prisma.planTestCase.findMany({
          where: { planId },
          include: {
            case: true,
            assignee: true,
            executions: {
              where: { buildId },
              orderBy: { executedAt: "desc" },
              take: 1,
            },
          },
          orderBy: { assignedAt: "asc" },
        })
      : [];

  const record = recordExecution.bind(null, locale);

  const statuses = [
    ExecutionStatus.PASSED,
    ExecutionStatus.FAILED,
    ExecutionStatus.BLOCKED,
    ExecutionStatus.SKIPPED,
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-slate-600 font-secondary">
          {project.name} · {t("subtitle")}
        </p>
      </div>

      <ExecutionFilters
        projectId={projectId}
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          builds: p.builds.map((b) => ({ id: b.id, name: b.name })),
          platforms: p.platforms.map((pp) => ({
            id: pp.platformId,
            name: pp.platform.name,
          })),
        }))}
        selectedPlanId={planId}
        selectedBuildId={buildId}
        selectedPlatformId={platformId}
      />

      {!planId || !buildId ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            {t("empty")}
          </CardContent>
        </Card>
      ) : planCases.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {planCases.map((pc) => {
            const latest = pc.executions[0];
            return (
              <Card key={pc.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base font-medium">
                      {caseExternalId(project.prefix, pc.case.externalId)} —{" "}
                      {pc.case.title}
                    </CardTitle>
                    {latest && (
                      <Badge
                        className={cn("border", statusColor(latest.status))}
                        variant="outline"
                      >
                        {latest.status.replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                  {pc.assignee && (
                    <p className="text-xs text-slate-500">
                      {t("assignee")}: {pc.assignee.name}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <form action={record} className="space-y-3">
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="planCaseId" value={pc.id} />
                    <input type="hidden" name="buildId" value={buildId} />
                    {platformId && (
                      <input type="hidden" name="platformId" value={platformId} />
                    )}
                    <div className="space-y-2">
                      <Label>{t("status")}</Label>
                      <div className="flex flex-wrap gap-2">
                        {statuses.map((s) => (
                          <label
                            key={s}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm cursor-pointer has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50"
                          >
                            <input
                              type="radio"
                              name="status"
                              value={s}
                              defaultChecked={s === ExecutionStatus.PASSED}
                              className="accent-teal-700"
                            />
                            {s === ExecutionStatus.PASSED && t("pass")}
                            {s === ExecutionStatus.FAILED && t("fail")}
                            {s === ExecutionStatus.BLOCKED && t("block")}
                            {s === ExecutionStatus.SKIPPED && t("skip")}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`notes-${pc.id}`}>{t("notes")}</Label>
                      <Textarea id={`notes-${pc.id}`} name="notes" rows={2} />
                    </div>
                    <Button type="submit" size="sm">
                      {t("saveResult")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
