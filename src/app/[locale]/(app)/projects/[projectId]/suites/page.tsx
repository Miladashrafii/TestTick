import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { caseExternalId } from "@/lib/utils";
import { createSuite } from "@/lib/actions/suites";
import { createCase } from "@/lib/actions/cases";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SuiteNode = { id: string; name: string; children: SuiteNode[] };

function SuiteTree({
  suites,
  selectedId,
  projectId,
  depth = 0,
}: {
  suites: SuiteNode[];
  selectedId: string | null;
  projectId: string;
  depth?: number;
}) {
  return (
    <ul className={cn(depth > 0 && "ms-3 border-s border-slate-200 ps-2")}>
      {suites.map((suite) => (
        <li key={suite.id} className="py-0.5">
          <Link
            href={`/projects/${projectId}/suites?suite=${suite.id}`}
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

  type Node = { id: string; name: string; children: Node[] };
  function walk(parentId: string | null): Node[] {
    return (byParent.get(parentId) ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      children: walk(s.id),
    }));
  }
  return walk(null);
}

export default async function SuitesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>;
  searchParams: Promise<{ suite?: string }>;
}) {
  const { locale, projectId } = await params;
  const { suite: suiteParam } = await searchParams;
  const t = await getTranslations("suites");

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
  });
  if (!project) notFound();

  const suitesFlat = await prisma.testSuite.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
  });
  const tree = buildTree(suitesFlat);

  const selectedSuiteId =
    suiteParam && suitesFlat.some((s) => s.id === suiteParam)
      ? suiteParam
      : (suitesFlat[0]?.id ?? null);

  const cases = selectedSuiteId
    ? await prisma.testCase.findMany({
        where: { suiteId: selectedSuiteId },
        orderBy: { externalId: "asc" },
      })
    : [];

  const createSuiteBound = createSuite.bind(null, locale);
  const createCaseBound = createCase.bind(null, locale);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-slate-600 font-secondary">
          {project.name} · {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr_300px]">
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
                selectedId={selectedSuiteId}
                projectId={projectId}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedSuiteId
                ? suitesFlat.find((s) => s.id === selectedSuiteId)?.name
                : t("empty")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedSuiteId ? (
              <p className="text-sm text-slate-500">{t("empty")}</p>
            ) : cases.length === 0 ? (
              <p className="text-sm text-slate-500">{t("empty")}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cases.map((c) => (
                  <li key={c.id} className="py-2.5 first:pt-0">
                    <Link
                      href={`/projects/${projectId}/cases/${c.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-teal-700"
                    >
                      {caseExternalId(project.prefix, c.externalId)} — {c.title}
                    </Link>
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
                  <Label htmlFor="parentId">Parent</Label>
                  <select
                    id="parentId"
                    name="parentId"
                    className="flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm"
                    defaultValue=""
                  >
                    <option value="">—</option>
                    {suitesFlat.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
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
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("newCase")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createCaseBound} className="space-y-3">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="suiteId" value={selectedSuiteId} />
                  <div className="space-y-1.5">
                    <Label htmlFor="caseTitle">Title</Label>
                    <Input id="caseTitle" name="title" required />
                  </div>
                  <Button type="submit" size="sm" className="w-full">
                    {t("newCase")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
