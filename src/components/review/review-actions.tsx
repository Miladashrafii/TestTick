import { ReviewStatus } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ReviewStatusBadge } from "@/components/review/review-status-badge";
import { submitCaseReview, submitPlanReview } from "@/lib/actions/forms";

/** Only these moves are offered, which keeps the workflow linear. */
const transitions: Record<ReviewStatus, ReviewStatus[]> = {
  DRAFT: [ReviewStatus.IN_REVIEW],
  IN_REVIEW: [ReviewStatus.APPROVED, ReviewStatus.REJECTED, ReviewStatus.DRAFT],
  APPROVED: [ReviewStatus.DRAFT],
  REJECTED: [ReviewStatus.IN_REVIEW, ReviewStatus.DRAFT],
};

const variantFor: Record<ReviewStatus, ButtonProps["variant"]> = {
  DRAFT: "ghost",
  IN_REVIEW: "default",
  APPROVED: "default",
  REJECTED: "destructive",
};

/** Label key per *target* status: moving to IN_REVIEW reads as "submit". */
const labelKey: Record<ReviewStatus, string> = {
  DRAFT: "backToDraft",
  IN_REVIEW: "submit",
  APPROVED: "approve",
  REJECTED: "reject",
};

export async function ReviewActions({
  locale,
  projectId,
  entity,
  entityId,
  status,
  reviewerName,
}: {
  locale: string;
  projectId: string;
  entity: "case" | "plan";
  entityId: string;
  status: ReviewStatus;
  reviewerName?: string | null;
}) {
  const t = await getTranslations("review");
  const action =
    entity === "case"
      ? submitCaseReview.bind(null, locale)
      : submitPlanReview.bind(null, locale);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("label")}
        </span>
        <ReviewStatusBadge status={status} />
      </div>

      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <input
          type="hidden"
          name={entity === "case" ? "caseId" : "planId"}
          value={entityId}
        />
        {transitions[status].map((target) => (
          <Button
            key={target}
            type="submit"
            name="reviewStatus"
            value={target}
            size="sm"
            variant={variantFor[target]}
          >
            {t(labelKey[target])}
          </Button>
        ))}
      </form>

      {reviewerName && (
        <p className="font-secondary text-xs text-slate-500">
          {t("reviewedBy", { name: reviewerName })}
        </p>
      )}
    </div>
  );
}
