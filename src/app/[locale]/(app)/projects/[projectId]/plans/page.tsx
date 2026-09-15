import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { createPlan } from "@/lib/actions/plans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default async function PlansListPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  const t = await getTranslations("plans");

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
  });
  if (!project) notFound();

  const plans = await prisma.testPlan.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { builds: true, cases: true } },
    },
  });

  const create = createPlan.bind(null, locale);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-slate-600 font-secondary">
          {project.name} · {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {plans.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                {t("empty")}
              </CardContent>
            </Card>
          ) : (
            plans.map((plan) => (
              <Link key={plan.id} href={`/projects/${projectId}/plans/${plan.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold text-slate-900">{plan.name}</h2>
                      <Badge variant={plan.active ? "success" : "secondary"}>
                        {plan.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2 font-secondary">
                      {plan.description || "—"}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {plan._count.builds} {t("builds")} · {plan._count.cases}{" "}
                      {t("assigned")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("create")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={create} className="space-y-4">
              <input type="hidden" name="projectId" value={projectId} />
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")}</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("description")}</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <Button type="submit" className="w-full">
                {t("create")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
