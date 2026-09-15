import { ReviewStatus } from "@prisma/client";
import { CheckCircle2, CircleDashed, Clock, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const presentation: Record<
  ReviewStatus,
  { icon: typeof CheckCircle2; className: string }
> = {
  DRAFT: { icon: CircleDashed, className: "border-slate-200 bg-slate-50 text-slate-700" },
  IN_REVIEW: { icon: Clock, className: "border-amber-200 bg-amber-50 text-amber-800" },
  APPROVED: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  REJECTED: { icon: XCircle, className: "border-rose-200 bg-rose-50 text-rose-800" },
};

export async function ReviewStatusBadge({
  status,
  className,
}: {
  status: ReviewStatus;
  className?: string;
}) {
  const t = await getTranslations("review");
  const { icon: Icon, className: tint } = presentation[status];

  return (
    <Badge variant="outline" className={cn("gap-1.5", tint, className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(`status.${status}`)}
    </Badge>
  );
}
