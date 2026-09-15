import { ExecutionType, Importance, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface CaseRecord {
  /** TestTick per-project case number. Null means "allocate the next free number". */
  externalId: number | null;
  suite: string;
  title: string;
  summary: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  importance: Importance;
  executionType: ExecutionType;
  reviewStatus: ReviewStatus;
  automationKey: string | null;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  suitesCreated: number;
  errors: string[];
}

export interface WriteOptions {
  authorId?: string;
  /** Suite used when a record carries no suite name. */
  fallbackSuiteName?: string;
}

export const CASE_COLUMNS = [
  "externalId",
  "suite",
  "title",
  "summary",
  "preconditions",
  "steps",
  "expectedResult",
  "importance",
  "executionType",
  "reviewStatus",
  "automationKey",
] as const;

export type CaseColumn = (typeof CASE_COLUMNS)[number];

const COLUMN_ALIASES: Record<string, CaseColumn> = {
  id: "externalId",
  externalid: "externalId",
  "external id": "externalId",
  case: "externalId",
  caseid: "externalId",
  suite: "suite",
  "test suite": "suite",
  suitename: "suite",
  folder: "suite",
  title: "title",
  name: "title",
  summary: "summary",
  description: "summary",
  preconditions: "preconditions",
  precondition: "preconditions",
  steps: "steps",
  actions: "steps",
  expectedresult: "expectedResult",
  "expected result": "expectedResult",
  expectedresults: "expectedResult",
  importance: "importance",
  priority: "importance",
  executiontype: "executionType",
  "execution type": "executionType",
  reviewstatus: "reviewStatus",
  "review status": "reviewStatus",
  status: "reviewStatus",
  automationkey: "automationKey",
  "automation key": "automationKey",
};

export function normalizeColumn(header: string): CaseColumn | null {
  const key = header.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
  return COLUMN_ALIASES[key] ?? COLUMN_ALIASES[key.replace(/\s/g, "")] ?? null;
}

export function toImportance(value: string | undefined): Importance {
  const key = (value ?? "").trim().toUpperCase();
  if (key === "HIGH" || key === "3") return Importance.HIGH;
  if (key === "LOW" || key === "1") return Importance.LOW;
  return Importance.MEDIUM;
}

export function toExecutionType(value: string | undefined): ExecutionType {
  const key = (value ?? "").trim().toUpperCase();
  return key === "AUTOMATED" || key === "AUTO" || key === "2"
    ? ExecutionType.AUTOMATED
    : ExecutionType.MANUAL;
}

export function toReviewStatus(value: string | undefined): ReviewStatus {
  const key = (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return key in ReviewStatus ? (key as ReviewStatus) : ReviewStatus.DRAFT;
}

export function toExternalId(value: string | number | undefined): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function emptyImportResult(): ImportResult {
  return { created: 0, updated: 0, skipped: 0, suitesCreated: 0, errors: [] };
}

export async function loadCaseRecords(projectId: string): Promise<CaseRecord[]> {
  const cases = await prisma.testCase.findMany({
    where: { projectId },
    orderBy: { externalId: "asc" },
    include: { suite: { select: { name: true } } },
  });

  return cases.map((testCase) => ({
    externalId: testCase.externalId,
    suite: testCase.suite.name,
    title: testCase.title,
    summary: testCase.summary,
    preconditions: testCase.preconditions,
    steps: testCase.steps,
    expectedResult: testCase.expectedResult,
    importance: testCase.importance,
    executionType: testCase.executionType,
    reviewStatus: testCase.reviewStatus,
    automationKey: testCase.automationKey,
  }));
}

export interface ProjectSuiteTreeNode {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  cases: CaseRecord[];
}

export async function loadSuiteTree(projectId: string): Promise<ProjectSuiteTreeNode[]> {
  const suites = await prisma.testSuite.findMany({
    where: { projectId },
    orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
    include: {
      cases: {
        orderBy: { externalId: "asc" },
        include: { suite: { select: { name: true } } },
      },
    },
  });

  return suites.map((suite) => ({
    id: suite.id,
    name: suite.name,
    description: suite.description,
    parentId: suite.parentId,
    cases: suite.cases.map((testCase) => ({
      externalId: testCase.externalId,
      suite: suite.name,
      title: testCase.title,
      summary: testCase.summary,
      preconditions: testCase.preconditions,
      steps: testCase.steps,
      expectedResult: testCase.expectedResult,
      importance: testCase.importance,
      executionType: testCase.executionType,
      reviewStatus: testCase.reviewStatus,
      automationKey: testCase.automationKey,
    })),
  }));
}

/**
 * Writes records into a project. Records carrying an existing case number update that case,
 * everything else is appended with a freshly allocated number.
 */
export async function writeCaseRecords(
  projectId: string,
  records: CaseRecord[],
  options: WriteOptions = {},
): Promise<ImportResult> {
  const result = emptyImportResult();
  if (records.length === 0) return result;

  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    result.errors.push("Project not found");
    return result;
  }

  const suites = await prisma.testSuite.findMany({
    where: { projectId },
    select: { id: true, name: true },
    orderBy: { orderIndex: "asc" },
  });
  const suiteIdByName = new Map(suites.map((suite) => [suite.name.toLowerCase(), suite.id]));
  let suiteCount = suites.length;

  const existing = await prisma.testCase.findMany({
    where: { projectId },
    select: { id: true, externalId: true },
  });
  const caseIdByExternalId = new Map(existing.map((item) => [item.externalId, item.id]));
  let nextExternalId = existing.reduce((max, item) => Math.max(max, item.externalId), 0) + 1;

  const fallbackSuiteName = options.fallbackSuiteName ?? "Imported";

  for (const record of records) {
    const title = record.title.trim();
    if (title.length === 0) {
      result.skipped += 1;
      result.errors.push("Skipped a row without a title");
      continue;
    }

    const suiteName = record.suite.trim().length > 0 ? record.suite.trim() : fallbackSuiteName;
    let suiteId = suiteIdByName.get(suiteName.toLowerCase());
    if (!suiteId) {
      const created = await prisma.testSuite.create({
        data: {
          projectId,
          name: suiteName,
          orderIndex: suiteCount + 1,
          authorId: options.authorId,
        },
        select: { id: true },
      });
      suiteId = created.id;
      suiteIdByName.set(suiteName.toLowerCase(), suiteId);
      suiteCount += 1;
      result.suitesCreated += 1;
    }

    const payload = {
      title,
      summary: record.summary,
      preconditions: record.preconditions,
      steps: record.steps,
      expectedResult: record.expectedResult,
      importance: record.importance,
      executionType: record.executionType,
      reviewStatus: record.reviewStatus,
      automationKey: record.automationKey,
      suiteId,
    };

    const existingId =
      record.externalId === null ? undefined : caseIdByExternalId.get(record.externalId);

    if (existingId) {
      await prisma.testCase.update({
        where: { id: existingId },
        data: { ...payload, version: { increment: 1 } },
      });
      result.updated += 1;
      continue;
    }

    const externalId = record.externalId ?? nextExternalId;
    const created = await prisma.testCase.create({
      data: { ...payload, projectId, externalId, authorId: options.authorId },
      select: { id: true, externalId: true },
    });
    caseIdByExternalId.set(created.externalId, created.id);
    if (externalId >= nextExternalId) nextExternalId = externalId + 1;
    result.created += 1;
  }

  return result;
}
