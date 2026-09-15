import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Compass, Flag } from "lucide-react";
import { SessionTimer } from "@/components/exploratory/session-timer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitSessionEnd,
  submitSessionNote,
  submitSessionStart,
} from "@/lib/actions/forms";
import { auth } from "@/lib/auth";
import { listExploratorySessions } from "@/lib/exploratory";
import { prisma } from "@/lib/prisma";

const DURATIONS = [30, 45, 60, 90, 120] as const;

export default async function ExploratoryPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  const t = await getTranslations("exploratory");
  const tCommon = await getTranslations("common");
  const session = await auth();
  if (!session?.user?.id) notFound();

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!project) notFound();

  const sessions = await listExploratorySessions(projectId);
  const active = sessions.filter((item) => item.status === "active");
  const finished = sessions.filter((item) => item.status !== "active");

  const start = submitSessionStart.bind(null, locale);
  const addNote = submitSessionNote.bind(null, locale);
  const end = submitSessionEnd.bind(null, locale);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
          <Compass className="size-6 text-teal-700" aria-hidden />
          {t("title")}
        </h1>
        <p className="mt-1 font-secondary text-slate-600">
          {project.name} · {t("subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("newSession")}</CardTitle>
          <p className="font-secondary text-sm text-slate-500">{t("charterHint")}</p>
        </CardHeader>
        <CardContent>
          <form action={start} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />
            <div className="space-y-1.5">
              <Label htmlFor="charter">{t("charter")}</Label>
              <Input
                id="charter"
                name="charter"
                required
                maxLength={500}
                placeholder={t("charterPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mission">{t("mission")}</Label>
              <Textarea
                id="mission"
                name="mission"
                rows={2}
                maxLength={1000}
                placeholder={t("missionPlaceholder")}
                className="min-h-[64px]"
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px] space-y-1.5">
                <Label htmlFor="durationMin">{t("duration")}</Label>
                <select
                  id="durationMin"
                  name="durationMin"
                  defaultValue={60}
                  className="flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm text-slate-900"
                >
                  {DURATIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {t("minutes", { count: minutes })}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit">{t("startSession")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("activeSessions")}
        </h2>
        {active.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              {t("noActive")}
            </CardContent>
          </Card>
        ) : (
          active.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{item.charter}</CardTitle>
                    {item.mission && (
                      <p className="mt-1 font-secondary text-sm text-slate-500">
                        {item.mission}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {t("ownedBy", { name: item.ownerName })}
                    </p>
                  </div>
                  <Badge variant="success">{t("status.active")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SessionTimer
                  startedAtIso={item.startedAt.toISOString()}
                  durationMin={item.durationMin}
                />

                {item.notes && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {t("notes")}
                    </p>
                    <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 font-mono text-xs text-slate-700">
                      {item.notes}
                    </pre>
                  </div>
                )}

                <form action={addNote} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="sessionId" value={item.id} />
                  <div className="min-w-[240px] flex-1 space-y-1.5">
                    <Label htmlFor={`note-${item.id}`}>{t("addNote")}</Label>
                    <Input
                      id={`note-${item.id}`}
                      name="note"
                      required
                      maxLength={5000}
                      placeholder={t("notePlaceholder")}
                    />
                  </div>
                  <Button type="submit" variant="secondary">
                    {tCommon("save")}
                  </Button>
                </form>

                <form
                  action={end}
                  className="flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-4"
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="sessionId" value={item.id} />
                  <Button type="submit" name="status" value="completed" size="sm">
                    <Flag aria-hidden />
                    {t("endSession")}
                  </Button>
                  <Button
                    type="submit"
                    name="status"
                    value="abandoned"
                    size="sm"
                    variant="ghost"
                  >
                    {t("abandonSession")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("pastSessions")}
        </h2>
        {finished.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              {t("noPast")}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {finished.map((item) => (
                  <li key={item.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {item.charter}
                        </p>
                        <p className="mt-0.5 font-secondary text-xs text-slate-500">
                          {t("sessionMeta", {
                            name: item.ownerName,
                            minutes: item.durationMin,
                          })}
                        </p>
                      </div>
                      <Badge
                        variant={item.status === "completed" ? "secondary" : "outline"}
                      >
                        {t(`status.${item.status}`)}
                      </Badge>
                    </div>
                    {item.notes && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-teal-700">
                          {t("showNotes")}
                        </summary>
                        <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 font-mono text-xs text-slate-700">
                          {item.notes}
                        </pre>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
