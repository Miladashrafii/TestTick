import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExecutionType, Importance, Prisma, ReviewStatus } from "@prisma/client";
import { Link } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { caseExternalId, cn, importanceColor } from "@/lib/utils";
import { createSuite } from "@/lib/actions/suites";
import { createCase } from "@/lib/actions/cases";
import { listSavedViews } from "@/lib/saved-views";
import { AiDraftPanel } from "@/components/cases/ai-draft-panel";
import { CaseFilters } from "@/components/suites/case-filters";
import { ReviewStatusBadge } from "@/components/review/review-status-badge";
import { SavedViewsBar } from "@/components/views/saved-views-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SuiteNode = { id: string; name: string; children: SuiteNode[] };

function SuiteTree({
  suites,
  selectedId,
  projectId,
  query,
  depth = 0,
}: {
  suites: SuiteNode[];
  selectedId: string | null;
  projectId: string;
  query: string;
  depth?: number;
}) {
  return (
    <ul className={cn(depth > 0 && "ms-3 border-s border-slate-200 ps-2")}>
      {suites.map((suite) => (
        <li key={suite.id} className="py-0.5">
          <Link
            href={`/projects/${projectId}/suites?suite=${suite.id}${query}`}
            className={cn(
              "block rounded-md px-2 py-1.5 text-sm transition-colors",
              selectedId === suite.id
                ? "bg-teal-700/10 font-medium text-teal-800"
                : "text-slate-700 hover:bg-slate-100",
            )}
          >
            {suite.name}
          </Link>
          {suite.children.length > 0 && (
            <SuiteTree
              suites={suite.children}
              selectedId={selectedId}
              projectId={projectId}
              query={query}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function buildTree(
  suites: { id: string; name: string; parentId: string | null; orderIndex: number }[],
) {
  const byParent = new Map<string | null, typeof suites>();
  for (const s of suites) {
    const key = s.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(s);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  function walk(parentId: string | null): SuiteNode[] {
    return (byParent.get(parentId) ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      children: walk(s.id),
    }));
  }
  return walk(null);
}

function asEnum<T extends Record<string, string>>(
  values: T,
  raw: string | undefined,
): T[keyof T] | undefined {
  return raw && raw in values ? (raw as T[keyof T]) : undefined;
}

export default async function SuitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams: Promise<{
    suite?: string;
    search?: string;
    importance?: string;
    reviewStatus?: string;
  }>;
}) {
  const { locale, projectId } = await params;
  const sp = await searchParams;
  const t = await getTranslations("suites");
  const tCases = await getTranslations("cases");
  const tFilters = await getTranslations("filters");

  const session = await auth();
  if (!session?.user?.id) notFound();

  const project = await prisma.testProject.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  const suitesFlat = await prisma.testSuite.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
  });
  const tree = buildTree(suitesFlat);

  const pickedSuiteId =
    sp.suite && suitesFlat.some((s) => s.id === sp.suite) ? sp.suite : null;
  const selectedSuiteId = pickedSuiteId ?? suitesFlat[0]?.id ?? null;

  const importance = asEnum(Importance, sp.importance);
  const reviewStatus = asEnum(ReviewStatus, sp.reviewStatus);
  const search = sp.search?.trim() ?? "";

  // An active search looks across the whole project; otherwise stay in the suite.
  const where: Prisma.TestCaseWhereInput = {
    projectId,
    ...(search.length > 0 ? {} : { suiteId: selectedSuiteId ?? undefined }),
    ...(importance ? { importance } : {}),
    ...(reviewStatus ? { reviewStatus } : {}),
    ...(search.length > 0
      ? {
          OR: [
            { title: { contains: search } },
            { summary: { contains: search } },
            { steps: { contains: search } },
          ],
        }
      : {}),
  };

  const cases = selectedSuiteId || search.length > 0
    ? await prisma.testCase.findMany({
        where,
        include: { suite: { select: { name: true } } },
        orderBy: { externalId: "asc" },
        take: 200,
      })
    : [];

  const savedViews = await listSavedViews(projectId, session.user.id, "cases");

  const filters = {
    search,
    importance: importance ?? "",
    reviewStatus: reviewStatus ?? "",
    // Only an explicit pick, so saving a view never pins the default suite.
    suite: pickedSuiteId ?? "",
  };
  const treeQuery = new URLSearchParams(
    Object.entries({
      search,
      importance: importance ?? "",
      reviewStatus: reviewStatus ?? "",
    }).filter(([, value]) => value !== ""),
  ).toString();

  const createSuiteBound = createSuite.bind(null, locale);
  const createCaseBound = createCase.bind(null, locale);
  const selectedSuiteName = suitesFlat.find((s) => s.id === selectedSuiteId)?.name;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 font-secondary text-slate-600">
          {project.name} · {t("subtitle")}
        </p>
      </div>

      <CaseFilters projectId={projectId} values={filters} />

      <SavedViewsBar
        locale={locale}
        projectId={projectId}
        currentUserId={session.user.id}
        basePath={`/projects/${projectId}/suites`}
        entity="cases"
        filters={filters}
        views={savedViews}
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr_320px]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("cases")}</CardTitle>
          </CardHeader>
          <CardContent>
            {tree.length === 0 ? (
              <p className="text-xs text-slate-500">{t("empty")}</p>
            ) : (
              <SuiteTree
                suites={tree}
                selectedId={search.length > 0 ? null : selectedSuiteId}
                projectId={projectId}
                query={treeQuery ? `&${treeQuery}` : ""}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {search.length > 0
                  ? tFilters("searchResults", { query: search })
                  : (selectedSuiteName ?? t("empty"))}
              </CardTitle>
              <Badge variant="secondary">{cases.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {cases.length === 0 ? (
              <p className="text-sm text-slate-500">{tFilters("noMatches")}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cases.map((testCase) => (
                  <li key={testCase.id} className="py-3 first:pt-0">
                    <Link
                      href={`/projects/${projectId}/cases/${testCase.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-teal-700"
                    >
                      {caseExternalId(project.prefix, testCase.externalId)} —{" "}
                      {testCase.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge className={cn(importanceColor(testCase.importance))}>
                        {testCase.importance}
                      </Badge>
                      <ReviewStatusBadge status={testCase.reviewStatus} />
                      {testCase.executionType === ExecutionType.AUTOMATED && (
                        <Badge variant="outline">{tCases("automated")}</Badge>
                      )}
                      {search.length > 0 && (
                        <span className="text-xs text-slate-500">
                          {testCase.suite.name}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t("newSuite")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createSuiteBound} className="space-y-3">
                <input type="hidden" name="projectId" value={projectId} />
                <div className="space-y-1.5">
                  <Label htmlFor="suiteName">{t("suiteName")}</Label>
                  <Input id="suiteName" name="name" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="parentId">{t("parentSuite")}</Label>
                  <select
                    id="parentId"
                    name="parentId"
                    className="flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm text-slate-900"
                    defaultValue=""
                  >
                    <option value="">—</option>
                    {suitesFlat.map((suite) => (
                      <option key={suite.id} value={suite.id}>
                        {suite.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" size="sm" className="w-full">
                  {t("newSuite")}
                </Button>
              </form>
            </CardContent>
          </Card>

          {selectedSuiteId && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">{t("newCase")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={createCaseBound} className="space-y-3">
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="suiteId" value={selectedSuiteId} />
                    <div className="space-y-1.5">
                      <Label htmlFor="caseTitle">{tCases("titleField")}</Label>
                      <Input id="caseTitle" name="title" required />
                    </div>
                    <Button type="submit" size="sm" className="w-full">
                      {t("newCase")}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <AiDraftPanel
                projectId={projectId}
                suiteId={selectedSuiteId}
                createAction={createCaseBound}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
