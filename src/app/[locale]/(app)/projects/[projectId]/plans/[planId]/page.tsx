import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { caseExternalId } from "@/lib/utils";
import {
  createBuild,
  createPlatformForPlan,
  assignCasesToPlan,
} from "@/lib/actions/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; planId: string }>;
}) {
  const { locale, projectId, planId } = await params;
  const t = await getTranslations("plans");
  const tCommon = await getTranslations("common");

  const plan = await prisma.testPlan.findFirst({
    where: { id: planId, projectId },
    include: {
      builds: { orderBy: { createdAt: "desc" } },
      platforms: { include: { platform: true } },
      cases: {
        include: {
          case: true,
          assignee: true,
        },
      },
    },
  });

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
  });

  if (!plan || !project) notFound();

  const assignedIds = new Set(plan.cases.map((pc) => pc.caseId));
  const unassignedCases = await prisma.testCase.findMany({
    where: {
      projectId,
      id: { notIn: [...assignedIds] },
    },
    orderBy: { externalId: "asc" },
    take: 50,
  });

  const addBuild = createBuild.bind(null, locale);
  const addPlatform = createPlatformForPlan.bind(null, locale);
  const assignCases = assignCasesToPlan.bind(null, locale);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href={`/projects/${projectId}/plans`}
          className="text-sm text-teal-700 hover:underline"
        >
          ← {tCommon("back")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {plan.name}
        </h1>
        <p className="mt-1 text-slate-600 font-secondary">
          {plan.description || "—"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("builds")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm space-y-1">
              {plan.builds.map((b) => (
                <li key={b.id} className="text-slate-700">
                  {b.name}
                  {!b.isOpen && (
                    <span className="text-slate-400 ms-2">(closed)</span>
                  )}
                </li>
              ))}
              {plan.builds.length === 0 && (
                <li className="text-slate-500">—</li>
              )}
            </ul>
            <form action={addBuild} className="flex gap-2">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="planId" value={planId} />
              <Input name="name" placeholder={t("newBuild")} required />
              <Button type="submit" size="sm">
                {tCommon("create")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("platforms")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm space-y-1">
              {plan.platforms.map((pp) => (
                <li key={pp.platformId}>{pp.platform.name}</li>
              ))}
              {plan.platforms.length === 0 && (
                <li className="text-slate-500">—</li>
              )}
            </ul>
            <form action={addPlatform} className="flex gap-2">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="planId" value={planId} />
              <Input name="name" placeholder="Platform" required />
              <Button type="submit" size="sm">
                {tCommon("create")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("assigned")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-slate-100 mb-6">
            {plan.cases.map((pc) => (
              <li key={pc.id} className="py-2 text-sm flex justify-between gap-2">
                <Link
                  href={`/projects/${projectId}/cases/${pc.caseId}`}
                  className="text-slate-900 hover:text-teal-700"
                >
                  {caseExternalId(project.prefix, pc.case.externalId)} —{" "}
                  {pc.case.title}
                </Link>
                {pc.assignee && (
                  <span className="text-slate-500 shrink-0">{pc.assignee.name}</span>
                )}
              </li>
            ))}
            {plan.cases.length === 0 && (
              <li className="py-4 text-slate-500 text-sm">—</li>
            )}
          </ul>

          {unassignedCases.length > 0 && (
            <form action={assignCases} className="space-y-3 border-t border-slate-100 pt-4">
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="planId" value={planId} />
              <Label>{t("addCases")}</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border border-slate-200 p-3">
                {unassignedCases.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-start gap-2 text-sm cursor-pointer"
                  >
                    <input type="checkbox" name="caseIds" value={c.id} className="mt-1" />
                    <span>
                      {caseExternalId(project.prefix, c.externalId)} — {c.title}
                    </span>
                  </label>
                ))}
              </div>
              <Button type="submit" size="sm">
                {t("addCases")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
