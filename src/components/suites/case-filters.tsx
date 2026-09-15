"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Importance, ReviewStatus } from "@prisma/client";
import { Search, X } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm text-slate-900";

export type CaseFilterValues = {
  search: string;
  importance: string;
  reviewStatus: string;
  suite: string;
};

export function CaseFilters({
  projectId,
  values,
}: {
  projectId: string;
  values: CaseFilterValues;
}) {
  const t = useTranslations("filters");
  const tCases = useTranslations("cases");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [search, setSearch] = React.useState(values.search);

  const hasFilters = Boolean(
    values.search || values.importance || values.reviewStatus,
  );

  const navigate = React.useCallback(
    (next: Partial<CaseFilterValues>) => {
      const merged = { ...values, search, ...next };
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(merged)) {
        if (value) query.set(key, value);
      }
      router.push(
        {
          pathname: "/projects/[projectId]/suites",
          params: { projectId },
          query: Object.fromEntries(query.entries()),
        } as Parameters<typeof router.push>[0],
      );
    },
    [values, search, router, projectId],
  );

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-4 py-4">
        <form
          className="min-w-[220px] flex-1 space-y-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({});
          }}
        >
          <Label htmlFor="case-search">{tCommon("search")}</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-slate-400"
              aria-hidden
            />
            <Input
              id="case-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="ps-9"
            />
          </div>
        </form>

        <div className="min-w-[150px] space-y-1.5">
          <Label htmlFor="filter-importance">{tCases("importance")}</Label>
          <select
            id="filter-importance"
            value={values.importance}
            onChange={(event) => navigate({ importance: event.target.value })}
            className={selectClass}
          >
            <option value="">{tCommon("all")}</option>
            {Object.values(Importance).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[170px] space-y-1.5">
          <Label htmlFor="filter-review">{t("reviewStatus")}</Label>
          <select
            id="filter-review"
            value={values.reviewStatus}
            onChange={(event) => navigate({ reviewStatus: event.target.value })}
            className={selectClass}
          >
            <option value="">{tCommon("all")}</option>
            {Object.values(ReviewStatus).map((value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              navigate({ search: "", importance: "", reviewStatus: "" });
            }}
          >
            <X aria-hidden />
            {t("clear")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
