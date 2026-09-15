import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { createRequirement } from "@/lib/actions/requirements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default async function RequirementsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  const t = await getTranslations("requirements");

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
  });
  if (!project) notFound();

  const requirements = await prisma.requirement.findMany({
    where: { projectId },
    orderBy: { docId: "asc" },
    include: { _count: { select: { coverage: true } } },
  });

  const create = createRequirement.bind(null, locale);

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
        <Card>
          <CardContent className="p-0">
            {requirements.length === 0 ? (
              <p className="p-6 text-sm text-slate-500 text-center">{t("empty")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-start text-slate-500">
                    <th className="px-5 py-3 font-medium">{t("docId")}</th>
                    <th className="px-5 py-3 font-medium">Title</th>
                    <th className="px-5 py-3 font-medium">{t("coverage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((req) => (
                    <tr key={req.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 font-mono text-xs">{req.docId}</td>
                      <td className="px-5 py-3">
                        <div className="font-medium text-slate-900">{req.title}</div>
                        {req.scope && (
                          <div className="text-xs text-slate-500 mt-0.5 font-secondary">
                            {req.scope}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="secondary">
                          {req._count.coverage} cases
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("create")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={create} className="space-y-4">
              <input type="hidden" name="projectId" value={projectId} />
              <div className="space-y-2">
                <Label htmlFor="docId">{t("docId")}</Label>
                <Input id="docId" name="docId" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scope">{t("scope")}</Label>
                <Textarea id="scope" name="scope" rows={3} />
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
