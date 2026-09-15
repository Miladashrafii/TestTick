import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExecutionType, Importance } from "@prisma/client";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { caseExternalId, importanceColor, cn } from "@/lib/utils";
import { updateCase } from "@/lib/actions/cases";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; caseId: string }>;
}) {
  const { locale, projectId, caseId } = await params;
  const t = await getTranslations("cases");
  const tCommon = await getTranslations("common");

  const testCase = await prisma.testCase.findFirst({
    where: { id: caseId, projectId },
    include: { project: true, suite: true },
  });
  if (!testCase) notFound();

  const save = updateCase.bind(null, locale);
  const extId = caseExternalId(testCase.project.prefix, testCase.externalId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/projects/${projectId}/suites?suite=${testCase.suiteId}`}
          className="text-sm text-teal-700 hover:underline"
        >
          ← {tCommon("back")}
        </Link>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("title")}
          </h1>
          <Badge variant="secondary">{extId}</Badge>
          <Badge className={cn(importanceColor(testCase.importance))}>
            {testCase.importance}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500 font-secondary">
          {testCase.suite.name} · v{testCase.version}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tCommon("edit")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={save} className="space-y-4">
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="projectId" value={projectId} />
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={testCase.title}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">{t("summary")}</Label>
              <Textarea
                id="summary"
                name="summary"
                rows={2}
                defaultValue={testCase.summary}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preconditions">{t("preconditions")}</Label>
              <Textarea
                id="preconditions"
                name="preconditions"
                rows={3}
                defaultValue={testCase.preconditions}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="steps">{t("steps")}</Label>
              <Textarea
                id="steps"
                name="steps"
                rows={5}
                defaultValue={testCase.steps}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedResult">{t("expected")}</Label>
              <Textarea
                id="expectedResult"
                name="expectedResult"
                rows={3}
                defaultValue={testCase.expectedResult}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="importance">{t("importance")}</Label>
                <select
                  id="importance"
                  name="importance"
                  defaultValue={testCase.importance}
                  className="flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm"
                >
                  {Object.values(Importance).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="executionType">{t("executionType")}</Label>
                <select
                  id="executionType"
                  name="executionType"
                  defaultValue={testCase.executionType}
                  className="flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm"
                >
                  {Object.values(ExecutionType).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit">{t("save")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
