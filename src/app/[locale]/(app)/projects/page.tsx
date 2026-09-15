import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { createProject } from "@/lib/actions/projects";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("projects");

  const projects = await prisma.testProject.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { cases: true, plans: true, members: true } },
    },
  });

  const create = createProject.bind(null, locale);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 text-slate-600 font-secondary">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {projects.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                {t("empty")}
              </CardContent>
            </Card>
          ) : (
            projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-slate-900 truncate">
                          {project.name}
                        </h2>
                        <Badge variant="secondary">{project.prefix}</Badge>
                        <Badge
                          variant={
                            project.status === "ACTIVE" ? "success" : "secondary"
                          }
                        >
                          {project.status === "ACTIVE"
                            ? t("active")
                            : t("inactive")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2 font-secondary">
                        {project.description || "—"}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {project._count.cases} cases · {project._count.plans}{" "}
                        plans · {project._count.members} {t("members")}
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-slate-400 rtl:rotate-180" />
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
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")}</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefix">{t("prefix")}</Label>
                <Input
                  id="prefix"
                  name="prefix"
                  required
                  maxLength={8}
                  className="uppercase"
                  placeholder="ABC"
                />
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
