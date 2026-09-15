import { IssueProvider } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { Bug, ExternalLink, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitIssueLink, submitIssueUnlink } from "@/lib/actions/forms";
import type { IssueLinkSummary } from "@/lib/issues";

const selectClass =
  "flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm text-slate-900";

export async function IssueLinksPanel({
  locale,
  projectId,
  caseId,
  executionId,
  links,
  /** Pre-filled "new issue" deep link, or null when no tracker is configured. */
  newIssueUrl,
  compact = false,
}: {
  locale: string;
  projectId: string;
  caseId?: string;
  executionId?: string;
  links: IssueLinkSummary[];
  newIssueUrl: string | null;
  compact?: boolean;
}) {
  const t = await getTranslations("issues");
  const tCommon = await getTranslations("common");
  const link = submitIssueLink.bind(null, locale);
  const unlink = submitIssueUnlink.bind(null, locale);
  const idSuffix = executionId ?? caseId ?? projectId;

  const body = (
    <div className="space-y-4">
      {links.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {links.map((issue) => (
            <li
              key={issue.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="secondary">{issue.provider}</Badge>
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate text-sm text-teal-700 hover:underline"
                >
                  {issue.title || issue.externalId || issue.url}
                </a>
                <ExternalLink
                  className="size-3.5 shrink-0 text-slate-400"
                  aria-hidden
                />
              </div>
              <form action={unlink}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="issueLinkId" value={issue.id} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  aria-label={`${t("unlink")} ${issue.externalId || issue.url}`}
                >
                  <Unlink aria-hidden />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {newIssueUrl ? (
        <Button asChild size="sm" variant="secondary">
          <a href={newIssueUrl} target="_blank" rel="noreferrer noopener">
            <Bug aria-hidden />
            {t("openGithub")}
          </a>
        </Button>
      ) : (
        <p className="text-xs text-slate-500">{t("noRepoConfigured")}</p>
      )}

      <form
        action={link}
        className="grid gap-3 border-t border-slate-200/70 pt-4 sm:grid-cols-[140px_1fr_auto]"
      >
        <input type="hidden" name="projectId" value={projectId} />
        {caseId && <input type="hidden" name="caseId" value={caseId} />}
        {executionId && (
          <input type="hidden" name="executionId" value={executionId} />
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`issue-provider-${idSuffix}`}>{t("provider")}</Label>
          <select
            id={`issue-provider-${idSuffix}`}
            name="provider"
            defaultValue={IssueProvider.GITHUB}
            className={selectClass}
          >
            {Object.values(IssueProvider).map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`issue-url-${idSuffix}`}>{t("url")}</Label>
          <Input
            id={`issue-url-${idSuffix}`}
            name="url"
            type="url"
            required
            placeholder="https://github.com/acme/app/issues/42"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" size="sm">
            {t("linkIssue")}
          </Button>
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor={`issue-title-${idSuffix}`}>
            {t("issueTitleOptional")}
          </Label>
          <Input
            id={`issue-title-${idSuffix}`}
            name="title"
            placeholder={tCommon("none")}
          />
        </div>
      </form>
    </div>
  );

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-200/70 bg-slate-50/60 p-4">
        <p className="mb-3 text-sm font-medium text-slate-700">{t("title")}</p>
        {body}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="font-secondary text-sm text-slate-500">{t("subtitle")}</p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
