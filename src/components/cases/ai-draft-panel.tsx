"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Importance } from "@prisma/client";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { draftCaseAction } from "@/lib/actions/ai";
import type { DraftedTestCase } from "@/lib/ai/draft-case";

const selectClass =
  "flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm text-slate-900";

export function AiDraftPanel({
  projectId,
  suiteId,
  createAction,
}: {
  projectId: string;
  suiteId: string;
  createAction: (formData: FormData) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("ai");
  const tCases = useTranslations("cases");
  const tCommon = useTranslations("common");

  const [prompt, setPrompt] = React.useState("");
  const [draft, setDraft] = React.useState<DraftedTestCase | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function generate() {
    const formData = new FormData();
    formData.set("prompt", prompt);
    formData.set("locale", locale);

    startTransition(async () => {
      const result = await draftCaseAction(locale, formData);
      if (!result.ok || !result.draft) {
        setError(result.error ?? "invalidPrompt");
        return;
      }
      setError(null);
      setDraft(result.draft);
    });
  }

  const canGenerate = prompt.trim().length >= 8 && !pending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-teal-700" aria-hidden />
          {t("title")}
        </CardTitle>
        <p className="font-secondary text-xs text-slate-500">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ai-prompt">{t("prompt")}</Label>
          <Textarea
            id="ai-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            placeholder={t("promptPlaceholder")}
            className="min-h-[72px]"
            aria-describedby="ai-prompt-hint"
          />
          <p id="ai-prompt-hint" className="text-xs text-slate-500">
            {t("promptHint")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={generate} disabled={!canGenerate}>
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Sparkles aria-hidden />
            )}
            {pending ? t("generating") : t("generate")}
          </Button>
          {draft && (
            <>
              <Badge variant="secondary">{t(`source.${draft.source}`)}</Badge>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDraft(null)}
              >
                <RotateCcw aria-hidden />
                {t("clear")}
              </Button>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-rose-700">
            {t(`error.${error}`)}
          </p>
        )}

        {draft && (
          <form
            action={createAction}
            className="space-y-3 border-t border-slate-200/70 pt-4"
          >
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="suiteId" value={suiteId} />
            <div className="space-y-1.5">
              <Label htmlFor="ai-title">{tCases("titleField")}</Label>
              <Input
                id="ai-title"
                name="title"
                required
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-summary">{tCases("summary")}</Label>
              <Textarea
                id="ai-summary"
                name="summary"
                rows={2}
                value={draft.summary}
                onChange={(event) =>
                  setDraft({ ...draft, summary: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-preconditions">{tCases("preconditions")}</Label>
              <Textarea
                id="ai-preconditions"
                name="preconditions"
                rows={2}
                value={draft.preconditions}
                onChange={(event) =>
                  setDraft({ ...draft, preconditions: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-steps">{tCases("steps")}</Label>
              <Textarea
                id="ai-steps"
                name="steps"
                rows={5}
                value={draft.steps}
                onChange={(event) => setDraft({ ...draft, steps: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-expected">{tCases("expected")}</Label>
              <Textarea
                id="ai-expected"
                name="expectedResult"
                rows={4}
                value={draft.expectedResult}
                onChange={(event) =>
                  setDraft({ ...draft, expectedResult: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-importance">{tCases("importance")}</Label>
              <select
                id="ai-importance"
                name="importance"
                defaultValue={Importance.MEDIUM}
                className={selectClass}
              >
                {Object.values(Importance).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">{t("reviewBeforeSave")}</p>
            <Button type="submit" size="sm" className="w-full">
              {tCommon("create")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
