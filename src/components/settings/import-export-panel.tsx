"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { ImportCasesState } from "@/lib/actions/import-export";

/** Mirrors `TRANSFER_FORMATS` in `@/lib/import-export`, which is server-only. */
const FORMATS = ["csv", "json", "xlsx", "testlink"] as const;
const IMPORT_FORMATS = ["csv", "xlsx", "testlink"] as const;

const initialState: ImportCasesState = {};

const selectClass =
  "flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm text-slate-900";

export function ImportExportPanel({
  projectId,
  importAction,
}: {
  projectId: string;
  importAction: (
    state: ImportCasesState,
    formData: FormData,
  ) => Promise<ImportCasesState>;
}) {
  const t = useTranslations("importExport");
  const tCommon = useTranslations("common");
  const [state, formAction, pending] = useActionState(importAction, initialState);

  return (
    <Card id="import-export">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="font-secondary text-sm text-slate-500">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-800">{t("export")}</h3>
          <p className="font-secondary text-sm text-slate-500">{t("exportHint")}</p>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((format) => (
              <Button key={format} asChild variant="secondary" size="sm">
                <a
                  href={`/api/projects/${projectId}/export?format=${format}`}
                  download
                >
                  <Download aria-hidden />
                  {t(`format.${format}`)}
                </a>
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-3 border-t border-slate-200/70 pt-5">
          <h3 className="text-sm font-semibold text-slate-800">{t("import")}</h3>
          <p className="font-secondary text-sm text-slate-500">{t("importHint")}</p>
          <form action={formAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="projectId" value={projectId} />
            <div className="min-w-[150px] space-y-1.5">
              <Label htmlFor="import-format">{t("formatField")}</Label>
              <select
                id="import-format"
                name="format"
                defaultValue="csv"
                className={selectClass}
              >
                {IMPORT_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {t(`format.${format}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <Label htmlFor="import-file">{t("file")}</Label>
              <input
                id="import-file"
                type="file"
                name="file"
                required
                accept=".csv,.xml,.xlsx,.json"
                className="flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2 text-sm text-slate-700 file:me-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium file:text-slate-700"
              />
            </div>
            <Button type="submit" disabled={pending}>
              <Upload aria-hidden />
              {pending ? tCommon("loading") : t("upload")}
            </Button>
          </form>

          {state.result && (
            <div aria-live="polite" className="space-y-1 text-sm">
              <p className="text-emerald-700">
                {t("importSummary", {
                  created: state.result.created,
                  updated: state.result.updated,
                  skipped: state.result.skipped,
                })}
              </p>
              {state.result.errors.length > 0 && (
                <ul className="list-inside list-disc text-xs text-amber-800">
                  {state.result.errors.slice(0, 5).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {state.error && (
            <p role="alert" className="text-sm text-rose-700">
              {t(`error.${state.error}`)}
            </p>
          )}
        </section>

        <section className="space-y-2 border-t border-slate-200/70 pt-5">
          <h3 className="text-sm font-semibold text-slate-800">
            {t("columnsTitle")}
          </h3>
          <p className="font-secondary text-sm text-slate-500">{t("columnsHint")}</p>
          <code className="block overflow-x-auto rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
            suite, externalId, title, summary, preconditions, steps, expectedResult,
            importance, executionType, reviewStatus
          </code>
        </section>
      </CardContent>
    </Card>
  );
}
