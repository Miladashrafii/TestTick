import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AtSign } from "lucide-react";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { CommentBox, type MentionMember } from "@/components/activity/comment-box";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/routing";
import { listProjectActivity, listUserMentions } from "@/lib/activity";
import { submitComment } from "@/lib/actions/forms";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectActivityPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  const t = await getTranslations("activity");
  const session = await auth();
  if (!session?.user?.id) notFound();

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!project) notFound();

  const [activities, members, mentions] = await Promise.all([
    listProjectActivity(projectId, { limit: 60 }),
    prisma.projectMember.findMany({
      where: { projectId },
      select: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    listUserMentions(session.user.id, { limit: 10 }),
  ]);

  const mentionMembers: MentionMember[] = members.map((member) => member.user);
  const projectMentions = mentions.filter(
    (mention) => mention.projectId === projectId,
  );
  const unreadCount = projectMentions.filter((mention) => !mention.read).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("title")}
        </h1>
        <p className="mt-1 font-secondary text-slate-600">
          {project.name} · {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("newComment")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentBox
                projectId={projectId}
                members={mentionMembers}
                postAction={submitComment.bind(null, locale)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("feed")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed locale={locale} items={activities} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <AtSign className="size-4 text-teal-700" aria-hidden />
                {t("yourMentions")}
                {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projectMentions.length === 0 ? (
                <p className="text-sm text-slate-500">{t("noMentions")}</p>
              ) : (
                <ul className="space-y-3">
                  {projectMentions.map((mention) => (
                    <li key={mention.mentionId} className="text-sm">
                      <p className="font-medium text-slate-900">
                        {mention.authorName}
                      </p>
                      <p className="line-clamp-3 font-secondary text-xs text-slate-600">
                        {mention.body}
                      </p>
                      {mention.caseId && (
                        <Link
                          href={`/projects/${projectId}/cases/${mention.caseId}`}
                          className="text-xs text-teal-700 hover:underline"
                        >
                          {t("openCase")}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">{t("members")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {mentionMembers.map((member) => (
                  <li key={member.id} className="text-xs">
                    <span className="font-medium text-slate-800">{member.name}</span>
                    <span className="ms-1.5 font-mono text-slate-500">
                      @{member.email}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
