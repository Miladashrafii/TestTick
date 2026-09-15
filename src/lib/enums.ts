import type {
  ActivityType,
  ExecutionStatus,
  ExecutionType,
  Importance,
  IssueProvider,
  ReviewStatus,
  Role,
} from "@prisma/client";

/**
 * Literal copies of the Prisma enums for use in modules that can end up in the client bundle.
 * The browser build of `@prisma/client` ships no enum objects, so referencing them at module
 * scope (for example inside `z.enum(...)`) throws. `satisfies` keeps these lists in sync with
 * the schema at compile time.
 */
export const REVIEW_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
] as const satisfies readonly ReviewStatus[];

export const ISSUE_PROVIDERS = [
  "GITHUB",
  "JIRA",
  "LINEAR",
  "CUSTOM",
] as const satisfies readonly IssueProvider[];

export const IMPORTANCES = ["HIGH", "MEDIUM", "LOW"] as const satisfies readonly Importance[];

export const EXECUTION_TYPES = [
  "MANUAL",
  "AUTOMATED",
] as const satisfies readonly ExecutionType[];

export const EXECUTION_STATUSES = [
  "NOT_RUN",
  "PASSED",
  "FAILED",
  "BLOCKED",
  "SKIPPED",
] as const satisfies readonly ExecutionStatus[];

export const ACTIVITY_TYPES = [
  "COMMENT",
  "STATUS_CHANGE",
  "ASSIGNMENT",
  "REVIEW",
  "EXECUTION",
  "SYSTEM",
  "MENTION",
] as const satisfies readonly ActivityType[];

export const ROLES = [
  "ADMINISTRATOR",
  "LEADER",
  "SENIOR_TESTER",
  "TESTER",
  "TEST_DESIGNER",
  "GUEST",
] as const satisfies readonly Role[];
