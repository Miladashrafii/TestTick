import type { IssueProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface IssueTemplate {
  title: string;
  body: string;
}

export interface IssueUrlInput extends IssueTemplate {
  /** Repository or workspace root, e.g. https://github.com/acme/storefront */
  baseUrl?: string;
  labels?: string[];
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function defaultBaseUrl(): string {
  return trimTrailingSlash(process.env.GITHUB_ISSUES_BASE_URL ?? "");
}

/**
 * Builds a "new issue" deep link. No OAuth or API token is involved: the user lands on a
 * pre-filled form in the tracker and we store the resulting link afterwards.
 */
export function buildGitHubIssueUrl(input: IssueUrlInput): string | null {
  const base = trimTrailingSlash(input.baseUrl ?? defaultBaseUrl());
  if (base.length === 0) return null;

  const target = base.endsWith("/issues/new") ? base : `${base}/issues/new`;
  const url = new URL(target);
  url.searchParams.set("title", input.title);
  url.searchParams.set("body", input.body);
  if (input.labels && input.labels.length > 0) {
    url.searchParams.set("labels", input.labels.join(","));
  }
  return url.toString();
}

export function buildIssueUrl(provider: IssueProvider, input: IssueUrlInput): string | null {
  const base = trimTrailingSlash(input.baseUrl ?? defaultBaseUrl());

  if (provider === "GITHUB") return buildGitHubIssueUrl(input);
  if (base.length === 0) return null;

  if (provider === "JIRA") {
    const url = new URL(`${base}/secure/CreateIssueDetails!init.jspa`);
    url.searchParams.set("summary", input.title);
    url.searchParams.set("description", input.body);
    return url.toString();
  }

  if (provider === "LINEAR") {
    const url = new URL(base.endsWith("/new") ? base : `${base}/new`);
    url.searchParams.set("title", input.title);
    url.searchParams.set("description", input.body);
    return url.toString();
  }

  const url = new URL(base);
  url.searchParams.set("title", input.title);
  url.searchParams.set("body", input.body);
  return url.toString();
}

export async function buildTemplateFromExecution(
  executionId: string,
): Promise<IssueTemplate | null> {
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      build: { select: { name: true, plan: { select: { name: true } } } },
      platform: { select: { name: true } },
      executor: { select: { name: true } },
      planCase: {
        select: {
          case: {
            select: {
              externalId: true,
              title: true,
              steps: true,
              expectedResult: true,
              preconditions: true,
              project: { select: { prefix: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!execution) return null;

  const testCase = execution.planCase.case;
  const reference = `${testCase.project.prefix}-${testCase.externalId}`;
  const facts = [
    `- Test case: ${reference} — ${testCase.title}`,
    `- Plan: ${execution.build.plan.name}`,
    `- Build: ${execution.build.name}`,
    `- Platform: ${execution.platform?.name ?? "—"}`,
    `- Status: ${execution.status}`,
    `- Source: ${execution.source}`,
    `- Executed at: ${execution.executedAt.toISOString()}`,
    `- Executed by: ${execution.executor?.name ?? "—"}`,
  ];

  const sections = [
    `## Summary\n${testCase.title} failed on build ${execution.build.name}.`,
    `## Run details\n${facts.join("\n")}`,
    testCase.preconditions.trim().length > 0
      ? `## Preconditions\n${testCase.preconditions.trim()}`
      : "",
    testCase.steps.trim().length > 0 ? `## Steps to reproduce\n${testCase.steps.trim()}` : "",
    testCase.expectedResult.trim().length > 0
      ? `## Expected result\n${testCase.expectedResult.trim()}`
      : "",
    execution.notes.trim().length > 0 ? `## Actual result / notes\n${execution.notes.trim()}` : "",
    `---\nReported from TestTick project “${testCase.project.name}”.`,
  ];

  return {
    title: `[${reference}] ${testCase.title} fails on ${execution.build.name}`,
    body: sections.filter((section) => section.length > 0).join("\n\n"),
  };
}

export interface IssueLinkSummary {
  id: string;
  provider: IssueProvider;
  externalId: string;
  url: string;
  title: string;
  createdAt: Date;
  caseId: string | null;
  executionId: string | null;
  createdByName: string | null;
}

export async function listIssueLinks(
  projectId: string,
  filter: { caseId?: string; executionId?: string } = {},
): Promise<IssueLinkSummary[]> {
  const links = await prisma.issueLink.findMany({
    where: {
      projectId,
      ...(filter.caseId ? { caseId: filter.caseId } : {}),
      ...(filter.executionId ? { executionId: filter.executionId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  return links.map((link) => ({
    id: link.id,
    provider: link.provider,
    externalId: link.externalId,
    url: link.url,
    title: link.title,
    createdAt: link.createdAt,
    caseId: link.caseId,
    executionId: link.executionId,
    createdByName: link.createdBy?.name ?? null,
  }));
}
