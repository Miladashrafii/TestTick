import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysPanel, type ApiKeyRow } from "@/components/settings/api-keys-panel";
import { CustomFieldsManager } from "@/components/settings/custom-fields-manager";
import { ImportExportPanel } from "@/components/settings/import-export-panel";
import { auth } from "@/lib/auth";
import { listApiKeys } from "@/lib/api-keys";
import { listCustomFields } from "@/lib/custom-fields";
import { createApiKeyState, importCasesState, submitApiKeyRevoke } from "@/lib/actions/forms";
import { prisma } from "@/lib/prisma";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  const t = await getTranslations("settings");
  const session = await auth();
  if (!session?.user?.id) notFound();

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, prefix: true },
  });
  if (!project) notFound();

  const [fields, apiKeys] = await Promise.all([
    listCustomFields(projectId),
    listApiKeys(projectId),
  ]);

  const keyRows: ApiKeyRow[] = apiKeys.map((key) => ({
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revoked: key.revokedAt !== null,
    ownerName: key.ownerName,
  }));

  const endpoints = [
    { method: "GET", path: "/api/v1/projects", description: t("api.listProjects") },
    {
      method: "GET",
      path: `/api/projects/${project.id}/export?format=csv`,
      description: t("api.exportCases"),
    },
    { method: "POST", path: "/api/presence", description: t("api.presence") },
    { method: "POST", path: "/api/graphql", description: t("api.graphql") },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 font-secondary text-slate-600">
          {project.name} · {t("subtitle")}
        </p>
      </div>

      <CustomFieldsManager locale={locale} projectId={projectId} fields={fields} />

      <ImportExportPanel
        projectId={projectId}
        importAction={importCasesState.bind(null, locale)}
      />

      <ApiKeysPanel
        projectId={projectId}
        keys={keyRows}
        createAction={createApiKeyState.bind(null, locale)}
        revokeAction={submitApiKeyRevoke.bind(null, locale)}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("api.title")}</CardTitle>
          <p className="font-secondary text-sm text-slate-500">{t("api.subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y divide-slate-100">
            {endpoints.map((endpoint) => (
              <li key={endpoint.path} className="py-2.5 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                    {endpoint.method}
                  </code>
                  <code className="font-mono text-xs text-slate-700">
                    {endpoint.path}
                  </code>
                </div>
                <p className="mt-0.5 font-secondary text-xs text-slate-500">
                  {endpoint.description}
                </p>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">{t("api.authTitle")}</p>
            <p className="font-secondary text-sm text-slate-500">{t("api.authHint")}</p>
            <code className="block overflow-x-auto rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
              Authorization: Bearer tt_…
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
