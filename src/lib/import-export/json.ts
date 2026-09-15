import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  emptyImportResult,
  loadSuiteTree,
  toExecutionType,
  toExternalId,
  toImportance,
  toReviewStatus,
  writeCaseRecords,
  type CaseRecord,
  type ImportResult,
  type WriteOptions,
} from "@/lib/import-export/case-records";

export const CASES_JSON_FORMAT = "testtick.cases";

export interface CasesJsonDocument {
  format: typeof CASES_JSON_FORMAT;
  version: 1;
  exportedAt: string;
  project: { id: string; name: string; prefix: string };
  suites: Array<{ name: string; description: string; cases: CaseRecord[] }>;
}

export async function exportCasesJson(projectId: string): Promise<string> {
  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, prefix: true },
  });
  if (!project) throw new Error("Project not found");

  const suites = await loadSuiteTree(projectId);
  const document: CasesJsonDocument = {
    format: CASES_JSON_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    suites: suites.map((suite) => ({
      name: suite.name,
      description: suite.description,
      cases: suite.cases,
    })),
  };

  return JSON.stringify(document, null, 2);
}

const caseSchema = z.object({
  externalId: z.union([z.number(), z.string()]).nullish(),
  suite: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().optional(),
  preconditions: z.string().optional(),
  steps: z.string().optional(),
  expectedResult: z.string().optional(),
  importance: z.string().optional(),
  executionType: z.string().optional(),
  reviewStatus: z.string().optional(),
  automationKey: z.string().nullish(),
});

const documentSchema = z.union([
  z.object({
    suites: z.array(
      z.object({ name: z.string().optional(), cases: z.array(caseSchema).default([]) }),
    ),
  }),
  z.object({ cases: z.array(caseSchema) }),
  z.array(caseSchema),
]);

type RawCase = z.infer<typeof caseSchema>;

function toRecord(raw: RawCase, suiteName: string): CaseRecord {
  return {
    externalId: toExternalId(raw.externalId ?? undefined),
    suite: raw.suite ?? suiteName,
    title: raw.title,
    summary: raw.summary ?? "",
    preconditions: raw.preconditions ?? "",
    steps: raw.steps ?? "",
    expectedResult: raw.expectedResult ?? "",
    importance: toImportance(raw.importance),
    executionType: toExecutionType(raw.executionType),
    reviewStatus: toReviewStatus(raw.reviewStatus),
    automationKey: raw.automationKey ?? null,
  };
}

export function jsonToCaseRecords(json: string): { records: CaseRecord[]; errors: string[] } {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return { records: [], errors: ["File is not valid JSON"] };
  }

  const parsed = documentSchema.safeParse(payload);
  if (!parsed.success) {
    return { records: [], errors: ["JSON does not describe a list of test cases"] };
  }

  if (Array.isArray(parsed.data)) {
    return { records: parsed.data.map((raw) => toRecord(raw, "")), errors: [] };
  }
  if ("cases" in parsed.data) {
    return { records: parsed.data.cases.map((raw) => toRecord(raw, "")), errors: [] };
  }

  const records = parsed.data.suites.flatMap((suite) =>
    suite.cases.map((raw) => toRecord(raw, suite.name ?? "")),
  );
  return { records, errors: [] };
}

export async function importCasesFromJson(
  projectId: string,
  json: string,
  options: WriteOptions = {},
): Promise<ImportResult> {
  const { records, errors } = jsonToCaseRecords(json);
  if (records.length === 0) return { ...emptyImportResult(), errors };

  const result = await writeCaseRecords(projectId, records, options);
  return { ...result, errors: [...errors, ...result.errors] };
}
