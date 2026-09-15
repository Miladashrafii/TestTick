import { ActivityType } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import {
  AtSign,
  CircleCheck,
  MessageSquare,
  PlayCircle,
  Settings2,
  UserCheck,
} from "lucide-react";
import type { ActivityEntry } from "@/lib/activity";
import { cn } from "@/lib/utils";

const typeIcon: Record<ActivityType, typeof MessageSquare> = {
  COMMENT: MessageSquare,
  STATUS_CHANGE: CircleCheck,
  ASSIGNMENT: UserCheck,
  REVIEW: CircleCheck,
  EXECUTION: PlayCircle,
  SYSTEM: Settings2,
  MENTION: AtSign,
};

const typeTint: Record<ActivityType, string> = {
  COMMENT: "bg-slate-100 text-slate-600",
  STATUS_CHANGE: "bg-sky-100 text-sky-800",
  ASSIGNMENT: "bg-teal-100 text-teal-800",
  REVIEW: "bg-emerald-100 text-emerald-800",
  EXECUTION: "bg-amber-100 text-amber-800",
  SYSTEM: "bg-slate-100 text-slate-600",
  MENTION: "bg-teal-100 text-teal-800",
};

const MENTION_SPLIT = /(@[\w.+-]+(?:@[\w-]+\.[\w.-]+)?)/g;
const MENTION_EXACT = /^@[\w.+-]+(?:@[\w-]+\.[\w.-]+)?$/;

/** Renders `@handle` / `@someone@example.com` as a highlighted chip. */
function ActivityBody({ body }: { body: string }) {
  return (
    <p className="whitespace-pre-wrap font-secondary text-sm text-slate-700">
      {body.split(MENTION_SPLIT).map((part, index) =>
        MENTION_EXACT.test(part) ? (
          <span
            key={`${part}-${index}`}
            className="rounded bg-teal-50 px-1 font-medium text-teal-800"
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export async function ActivityFeed({
  locale,
  items,
  className,
}: {
  locale: string;
  items: ActivityEntry[];
  className?: string;
}) {
  const t = await getTranslations("activity");
  const dateLocale = locale === "fa" ? { locale: faIR } : {};

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{t("empty")}</p>;
  }

  return (
    <ol className={cn("space-y-4", className)}>
      {items.map((item) => {
        const Icon = typeIcon[item.type];
        return (
          <li key={item.id} className="flex gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                typeTint[item.type],
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span className="font-medium text-slate-900">{item.authorName}</span>
                <span className="text-slate-500">{t(`type.${item.type}`)}</span>
                <time
                  dateTime={item.createdAt.toISOString()}
                  className="text-xs text-slate-400"
                >
                  {formatDistanceToNow(item.createdAt, {
                    addSuffix: true,
                    ...dateLocale,
                  })}
                </time>
                {item.mentionedUserIds.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 text-xs text-teal-800">
                    <AtSign className="size-3" aria-hidden />
                    {item.mentionedUserIds.length}
                  </span>
                )}
              </div>
              <div className="mt-1">
                <ActivityBody body={item.body} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
