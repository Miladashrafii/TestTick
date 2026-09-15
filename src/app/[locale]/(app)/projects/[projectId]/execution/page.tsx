import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExecutionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { caseExternalId, cn, statusColor } from "@/lib/utils";
import { recordExecution } from "@/lib/actions/executions";
import {
  buildGitHubIssueUrl,
  buildTemplateFromExecution,
  listIssueLinks,
} from "@/lib/issues";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExecutionFilters } from "@/components/execution/execution-filters";
import {
  ExecutionBoard,
  type ExecutionBoardCase,
} from "@/components/execution/execution-board";
import { IssueLinksPanel } from "@/components/issues/issue-links-panel";

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
  const tIssues = await getTranslations("issues");

  const project = await prisma.testProject.findUnique({ where: { id: projectId } });
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
            case: { select: { id: true, externalId: true, title: true } },
            assignee: { select: { name: true } },
            executions: {
              where: { buildId },
              orderBy: { executedAt: "desc" },
              take: 1,
            },
          },
          orderBy: { assignedAt: "asc" },
        })
      : [];

  const boardCases: ExecutionBoardCase[] = planCases.map((planCase) => {
    const latest = planCase.executions[0];
    return {
      planCaseId: planCase.id,
      caseId: planCase.case.id,
      caseRef: caseExternalId(project.prefix, planCase.case.externalId),
      title: planCase.case.title,
      assigneeName: planCase.assignee?.name ?? null,
      latestStatus: latest?.status ?? null,
      latestNotes: latest?.notes ?? "",
    };
  });

  const failed = buildId
    ? await prisma.execution.findMany({
        where: {
          buildId,
          status: ExecutionStatus.FAILED,
          planCase: { plan: { projectId } },
        },
        orderBy: { executedAt: "desc" },
        take: 5,
        include: {
          planCase: {
            include: { case: { select: { id: true, externalId: true, title: true } } },
          },
        },
      })
    : [];

  const failedPanels = await Promise.all(
    failed.map(async (execution) => {
      const [template, links] = await Promise.all([
        buildTemplateFromExecution(execution.id),
        listIssueLinks(projectId, { executionId: execution.id }),
      ]);
      return {
        execution,
        links,
        newIssueUrl: template
          ? buildGitHubIssueUrl({ ...template, labels: ["bug"] })
          : null,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 font-secondary text-slate-600">
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

      {!planId || !buildId || boardCases.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <ExecutionBoard
          projectId={projectId}
          buildId={buildId}
          platformId={platformId}
          cases={boardCases}
          saveAction={recordExecution.bind(null, locale)}
        />
      )}

      {failedPanels.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {tIssues("failedInBuild")}
          </h2>
          {failedPanels.map(({ execution, links, newIssueUrl }) => (
            <Card key={execution.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">
                    <span className="font-mono text-xs text-slate-500">
                      {caseExternalId(project.prefix, execution.planCase.case.externalId)}
                    </span>{" "}
                    {execution.planCase.case.title}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={cn("border", statusColor(execution.status))}
                  >
                    {execution.status}
                  </Badge>
                </div>
                {execution.notes && (
                  <p className="font-secondary text-xs text-slate-500">
                    {execution.notes}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <IssueLinksPanel
                  locale={locale}
                  projectId={projectId}
                  executionId={execution.id}
                  links={links}
                  newIssueUrl={newIssueUrl}
                  compact
                />
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
