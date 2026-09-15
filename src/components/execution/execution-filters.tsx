"use client";

import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type PlanOption = {
  id: string;
  name: string;
  builds: { id: string; name: string }[];
  platforms: { id: string; name: string }[];
};

export function ExecutionFilters({
  projectId,
  plans,
  selectedPlanId,
  selectedBuildId,
  selectedPlatformId,
}: {
  projectId: string;
  plans: PlanOption[];
  selectedPlanId?: string;
  selectedBuildId?: string;
  selectedPlatformId?: string;
}) {
  const t = useTranslations("execution");
  const router = useRouter();

  const plan = plans.find((p) => p.id === selectedPlanId);

  function navigate(plan?: string, build?: string, platform?: string) {
    const params = new URLSearchParams();
    if (plan) params.set("plan", plan);
    if (build) params.set("build", build);
    if (platform) params.set("platform", platform);
    router.push(
      {
        pathname: "/projects/[projectId]/execution",
        params: { projectId },
        query: Object.fromEntries(params.entries()),
      } as Parameters<typeof router.push>[0],
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap gap-4 pt-5">
        <div className="space-y-1.5 min-w-[180px]">
          <Label>{t("plan")}</Label>
          <select
            className="flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm"
            value={selectedPlanId ?? ""}
            onChange={(e) => {
              const p = plans.find((x) => x.id === e.target.value);
              navigate(e.target.value, p?.builds[0]?.id);
            }}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 min-w-[160px]">
          <Label>{t("build")}</Label>
          <select
            className="flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm"
            value={selectedBuildId ?? ""}
            onChange={(e) =>
              navigate(selectedPlanId, e.target.value, selectedPlatformId)
            }
            disabled={!plan?.builds.length}
          >
            {plan?.builds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 min-w-[160px]">
          <Label>{t("platform")}</Label>
          <select
            className="flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm"
            value={selectedPlatformId ?? ""}
            onChange={(e) =>
              navigate(
                selectedPlanId,
                selectedBuildId,
                e.target.value || undefined,
              )
            }
          >
            <option value="">{t("anyPlatform")}</option>
            {plan?.platforms.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
}
