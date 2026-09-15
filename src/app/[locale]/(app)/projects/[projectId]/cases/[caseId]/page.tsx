import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExecutionType, Importance } from "@prisma/client";
import { Link } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { caseExternalId, cn, importanceColor } from "@/lib/utils";
import { updateCase } from "@/lib/actions/cases";
import { submitComment, submitDataset, submitDatasetDelete } from "@/lib/actions/forms";
import { listProjectActivity } from "@/lib/activity";
import { listCaseFieldValues } from "@/lib/custom-fields";
import { listCaseDatasets } from "@/lib/datasets";
import { buildGitHubIssueUrl, listIssueLinks } from "@/lib/issues";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { CommentBox, type MentionMember } from "@/components/activity/comment-box";
import { CaseDatasets } from "@/components/cases/case-datasets";
import { CustomFieldValues } from "@/components/cases/custom-field-values";
import { IssueLinksPanel } from "@/components/issues/issue-links-panel";
import { ReviewActions } from "@/components/review/review-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm text-slate-900";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; caseId: string }>;
}) {
  const { locale, projectId, caseId } = await params;
  const t = await getTranslations("cases");
  const tCommon = await getTranslations("common");
  const tActivity = await getTranslations("activity");

  const session = await auth();
  if (!session?.user?.id) notFound();

  const testCase = await prisma.testCase.findFirst({
    where: { id: caseId, projectId },
    include: {
      project: true,
      suite: true,
      reviewer: { select: { name: true } },
    },
  });
  if (!testCase) notFound();

  const [fields, datasets, issueLinks, activities, members] = await Promise.all([
    listCaseFieldValues(projectId, caseId),
    listCaseDatasets(caseId),
    listIssueLinks(projectId, { caseId }),
    listProjectActivity(projectId, { limit: 20, target: { caseId } }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const save = updateCase.bind(null, locale);
  const extId = caseExternalId(testCase.project.prefix, testCase.externalId);
  const mentionMembers: MentionMember[] = members.map((member) => member.user);

  const newIssueUrl = buildGitHubIssueUrl({
    title: `[${extId}] ${testCase.title}`,
    body: [
      `## Summary\n${testCase.summary || testCase.title}`,
      testCase.preconditions.trim()
        ? `## Preconditions\n${testCase.preconditions.trim()}`
        : "",
      testCase.steps.trim() ? `## Steps to reproduce\n${testCase.steps.trim()}` : "",
      testCase.expectedResult.trim()
        ? `## Expected result\n${testCase.expectedResult.trim()}`
        : "",
      `---\nReported from TestTick project “${testCase.project.name}”.`,
    ]
      .filter((section) => section.length > 0)
      .join("\n\n"),
    labels: ["bug"],
  });

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
            {testCase.title}
          </h1>
          <Badge variant="secondary">{extId}</Badge>
          <Badge className={cn(importanceColor(testCase.importance))}>
            {testCase.importance}
          </Badge>
        </div>
        <p className="mt-1 font-secondary text-sm text-slate-500">
          {testCase.suite.name} · v{testCase.version}
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <ReviewActions
            locale={locale}
            projectId={projectId}
            entity="case"
            entityId={caseId}
            status={testCase.reviewStatus}
            reviewerName={testCase.reviewer?.name}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tCommon("edit")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={save} className="space-y-4">
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="projectId" value={projectId} />
            <div className="space-y-2">
              <Label htmlFor="title">{t("titleField")}</Label>
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
                  className={selectClass}
                >
                  {Object.values(Importance).map((value) => (
                    <option key={value} value={value}>
                      {value}
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
                  className={selectClass}
                >
                  {Object.values(ExecutionType).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit">{t("save")}</Button>
          </form>
        </CardContent>
      </Card>

      <CustomFieldValues
        locale={locale}
        projectId={projectId}
        caseId={caseId}
        fields={fields}
      />

      <CaseDatasets
        projectId={projectId}
        caseId={caseId}
        datasets={datasets.map((dataset) => ({
          id: dataset.id,
          name: dataset.name,
          rows: dataset.rows,
        }))}
        saveAction={submitDataset.bind(null, locale)}
        deleteAction={submitDatasetDelete.bind(null, locale)}
      />

      <IssueLinksPanel
        locale={locale}
        projectId={projectId}
        caseId={caseId}
        links={issueLinks}
        newIssueUrl={newIssueUrl}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tActivity("caseTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <CommentBox
            projectId={projectId}
            caseId={caseId}
            members={mentionMembers}
            postAction={submitComment.bind(null, locale)}
          />
          <div className="border-t border-slate-200/70 pt-5">
            <ActivityFeed locale={locale} items={activities} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
