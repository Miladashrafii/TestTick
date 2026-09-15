import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  ClipboardList,
  PlayCircle,
  Link2,
  BarChart3,
} from "lucide-react";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { projectId } = await params;
  const t = await getTranslations("projects");
  const tNav = await getTranslations("nav");

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: {
          cases: true,
          plans: true,
          suites: true,
          requirements: true,
        },
      },
    },
  });

  if (!project) notFound();

  const links = [
    {
      href: `/projects/${projectId}/suites`,
      label: tNav("testSpecs"),
      desc: `${project._count.suites} suites · ${project._count.cases} cases`,
      icon: FileText,
    },
    {
      href: `/projects/${projectId}/plans`,
      label: tNav("testPlans"),
      desc: `${project._count.plans} plans`,
      icon: ClipboardList,
    },
    {
      href: `/projects/${projectId}/execution`,
      label: tNav("execution"),
      desc: tNav("execution"),
      icon: PlayCircle,
    },
    {
      href: `/projects/${projectId}/requirements`,
      label: tNav("requirements"),
      desc: `${project._count.requirements} requirements`,
      icon: Link2,
    },
    {
      href: `/projects/${projectId}/reports`,
      label: tNav("reports"),
      desc: tNav("reports"),
      icon: BarChart3,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {project.name}
          </h1>
          <Badge variant="secondary">{project.prefix}</Badge>
        </div>
        <p className="mt-2 text-slate-600 font-secondary max-w-2xl">
          {project.description || "—"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-teal-700/10 text-teal-700">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{item.label}</CardTitle>
                    <p className="text-sm text-slate-500 mt-1 font-secondary">
                      {item.desc}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="text-sm font-medium text-teal-700">
                    {t("open")} →
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
