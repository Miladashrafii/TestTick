import { getTranslations } from "next-intl/server";
import { BookmarkPlus, ChevronDown, Share2, Trash2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitSavedView, submitSavedViewDelete } from "@/lib/actions/forms";
import {
  viewFiltersToSearchParams,
  type SavedViewSummary,
} from "@/lib/saved-views";

export async function SavedViewsBar({
  locale,
  projectId,
  currentUserId,
  /** Locale-less path the view links point at, e.g. `/projects/x/suites`. */
  basePath,
  entity,
  filters,
  views,
}: {
  locale: string;
  projectId: string;
  currentUserId: string;
  basePath: string;
  entity: "cases" | "plans" | "executions" | "requirements";
  filters: Record<string, string>;
  views: SavedViewSummary[];
}) {
  const t = await getTranslations("views");
  const tCommon = await getTranslations("common");
  const save = submitSavedView.bind(null, locale);
  const remove = submitSavedViewDelete.bind(null, locale);

  const activeFilters = Object.entries(filters).filter(([, value]) => value !== "");

  return (
    <div className="flex flex-wrap items-end gap-4">
      <details className="group relative">
        <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200/80 bg-white/80 px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40">
          <Share2 className="size-4 opacity-70" aria-hidden />
          {t("sharedViews")}
          <Badge variant="secondary">{views.length}</Badge>
          <ChevronDown
            className="size-4 opacity-60 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="absolute start-0 top-full z-30 mt-1 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {views.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">{t("noViews")}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {views.map((view) => {
                const query = viewFiltersToSearchParams(view.filters);
                return (
                  <li key={view.id} className="flex items-center gap-1">
                    <Link
                      href={query ? `${basePath}?${query}` : basePath}
                      className="min-w-0 flex-1 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="block truncate font-medium">{view.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {view.shared
                          ? t("sharedBy", { name: view.ownerName })
                          : t("private")}
                      </span>
                    </Link>
                    {view.ownerId === currentUserId && (
                      <form action={remove}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="viewId" value={view.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          aria-label={`${tCommon("delete")} ${view.name}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>

      <form action={save} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="entity" value={entity} />
        <input
          type="hidden"
          name="filtersJson"
          value={JSON.stringify(Object.fromEntries(activeFilters))}
        />
        <div className="space-y-1.5">
          <Label htmlFor="view-name">{t("saveCurrent")}</Label>
          <Input
            id="view-name"
            name="name"
            required
            placeholder={t("namePlaceholder")}
            className="w-52"
            aria-describedby="view-name-hint"
          />
        </div>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="shared"
            defaultChecked
            className="size-4 rounded accent-teal-700"
          />
          {t("shareWithTeam")}
        </label>
        <Button type="submit" variant="secondary">
          <BookmarkPlus aria-hidden />
          {tCommon("save")}
        </Button>
        <p id="view-name-hint" className="pb-2.5 text-xs text-slate-500">
          {t("filtersCaptured", { count: activeFilters.length })}
        </p>
      </form>
    </div>
  );
}
