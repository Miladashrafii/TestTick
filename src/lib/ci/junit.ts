import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { ExecutionStatus, Importance } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type JUnitStatus = "passed" | "failed" | "skipped";

export interface JUnitTestCase {
  name: string;
  classname: string;
  suiteName: string;
  status: JUnitStatus;
  /** JUnit reports seconds; kept as reported and converted to ms when persisted. */
  durationSeconds: number | null;
  message: string;
}

export interface JUnitTotals {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface ParsedJUnit {
  cases: JUnitTestCase[];
  totals: JUnitTotals;
}

export interface JUnitImportInput {
  projectId: string;
  planId: string;
  xml: string;
  buildId?: string;
  buildName?: string;
  platformId?: string;
  executorId?: string;
}

export interface JUnitImportSummary {
  importId: string;
  planId: string;
  buildId: string;
  buildName: string;
  buildCreated: boolean;
  totals: JUnitTotals;
  matched: number;
  unmatched: number;
  executionsCreated: number;
  planCasesCreated: number;
  unmatchedKeys: string[];
}

export class JUnitImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JUnitImportError";
  }
}

const ATTR_PREFIX = "@_";
const MAX_NOTE_LENGTH = 2000;
const MAX_REPORTED_UNMATCHED = 100;

type XmlNode = Record<string, unknown>;

function isRecord(value: unknown): value is XmlNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function readString(node: XmlNode, key: string): string {
  const value = node[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function readNumber(node: XmlNode, key: string): number | null {
  const value = node[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Failure/error/skipped children can be self-closing, text-only, or attribute-carrying nodes. */
function readOutcomeMessage(value: unknown): string {
  const parts: string[] = [];
  for (const entry of asArray(value)) {
    if (typeof entry === "string") {
      parts.push(entry.trim());
      continue;
    }
    if (!isRecord(entry)) continue;
    const message = readString(entry, `${ATTR_PREFIX}message`);
    const type = readString(entry, `${ATTR_PREFIX}type`);
    const text = readString(entry, "#text");
    parts.push([type, message, text].filter((part) => part.length > 0).join(": "));
  }
  return parts.filter((part) => part.length > 0).join("\n");
}

export function parseJUnitXml(xml: string): ParsedJUnit {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    parseAttributeValue: false,
    trimValues: true,
  });

  let document: unknown;
  try {
    document = parser.parse(xml);
  } catch (error) {
    throw new JUnitImportError(
      `Could not parse JUnit XML: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
  if (!isRecord(document)) throw new JUnitImportError("JUnit XML has no root element");

  const cases: JUnitTestCase[] = [];
  const roots = [...asArray(document.testsuites), ...asArray(document.testsuite)];
  if (roots.length === 0) {
    throw new JUnitImportError("JUnit XML contains no <testsuite> or <testsuites> element");
  }
  for (const root of roots) {
    collectSuite(root, "", cases);
  }

  const totals = cases.reduce<JUnitTotals>(
    (acc, testCase) => {
      acc.total += 1;
      if (testCase.status === "passed") acc.passed += 1;
      else if (testCase.status === "failed") acc.failed += 1;
      else acc.skipped += 1;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0 },
  );

  return { cases, totals };
}

function collectSuite(node: unknown, parentName: string, out: JUnitTestCase[]): void {
  if (!isRecord(node)) return;

  const ownName = readString(node, `${ATTR_PREFIX}name`);
  const suiteName = [parentName, ownName].filter((part) => part.length > 0).join(" / ");

  for (const child of asArray(node.testsuite)) {
    collectSuite(child, suiteName, out);
  }

  for (const raw of asArray(node.testcase)) {
    if (!isRecord(raw)) continue;
    const failureMessage = readOutcomeMessage(raw.failure);
    const errorMessage = readOutcomeMessage(raw.error);
    const skippedMessage = readOutcomeMessage(raw.skipped);
    const hasFailure = raw.failure !== undefined || raw.error !== undefined;
    const hasSkip = raw.skipped !== undefined;

    out.push({
      name: readString(raw, `${ATTR_PREFIX}name`),
      classname: readString(raw, `${ATTR_PREFIX}classname`),
      suiteName,
      status: hasFailure ? "failed" : hasSkip ? "skipped" : "passed",
      durationSeconds: readNumber(raw, `${ATTR_PREFIX}time`),
      message: [failureMessage, errorMessage, skippedMessage]
        .filter((part) => part.length > 0)
        .join("\n"),
    });
  }
}

/** Ordered candidates, most specific first, matched against stored automation keys. */
export function automationKeyCandidates(testCase: JUnitTestCase): string[] {
  const { name, classname, suiteName } = testCase;
  const candidates = [
    classname && name ? `${classname}.${name}` : "",
    classname && name ? `${classname}#${name}` : "",
    classname && name ? `${classname}::${name}` : "",
    suiteName && name ? `${suiteName} / ${name}` : "",
    name,
    classname,
  ];
  return [...new Set(candidates.map((value) => value.trim()).filter((value) => value.length > 0))];
}

const STATUS_BY_JUNIT: Record<JUnitStatus, ExecutionStatus> = {
  passed: ExecutionStatus.PASSED,
  failed: ExecutionStatus.FAILED,
  skipped: ExecutionStatus.SKIPPED,
};

export async function importJUnitXml(input: JUnitImportInput): Promise<JUnitImportSummary> {
  const parsed = parseJUnitXml(input.xml);

  const plan = await prisma.testPlan.findFirst({
    where: { id: input.planId, projectId: input.projectId },
    select: { id: true, name: true },
  });
  if (!plan) throw new JUnitImportError("Test plan not found in this project");

  const build = await resolveBuild(plan.id, input.buildId, input.buildName);

  const [mappings, keyedCases, planCases] = await Promise.all([
    prisma.automationMapping.findMany({
      where: { projectId: input.projectId },
      select: { automationKey: true, caseId: true },
    }),
    prisma.testCase.findMany({
      where: { projectId: input.projectId, automationKey: { not: null } },
      select: { id: true, automationKey: true },
    }),
    prisma.planTestCase.findMany({
      where: { planId: plan.id },
      select: { id: true, caseId: true },
    }),
  ]);

  const caseByKey = new Map<string, string>();
  for (const testCase of keyedCases) {
    if (testCase.automationKey) caseByKey.set(testCase.automationKey, testCase.id);
  }
  // Explicit mappings win over the convenience field on the case itself.
  for (const mapping of mappings) caseByKey.set(mapping.automationKey, mapping.caseId);

  const planCaseByCaseId = new Map(planCases.map((link) => [link.caseId, link.id]));

  const unmatchedKeys: string[] = [];
  let matched = 0;
  let planCasesCreated = 0;
  let executionsCreated = 0;

  for (const testCase of parsed.cases) {
    const candidates = automationKeyCandidates(testCase);
    const key = candidates.find((candidate) => caseByKey.has(candidate));
    if (!key) {
      unmatchedKeys.push(candidates[0] ?? "(unnamed testcase)");
      continue;
    }

    matched += 1;
    const caseId = caseByKey.get(key);
    if (!caseId) continue;

    let planCaseId = planCaseByCaseId.get(caseId);
    if (!planCaseId) {
      const created = await prisma.planTestCase.create({
        data: { planId: plan.id, caseId, priority: Importance.MEDIUM },
        select: { id: true },
      });
      planCaseId = created.id;
      planCaseByCaseId.set(caseId, planCaseId);
      planCasesCreated += 1;
    }

    await prisma.execution.create({
      data: {
        planCaseId,
        buildId: build.id,
        platformId: input.platformId,
        executorId: input.executorId,
        status: STATUS_BY_JUNIT[testCase.status],
        source: "ci",
        notes: buildNotes(testCase),
        duration:
          testCase.durationSeconds === null
            ? null
            : Math.round(testCase.durationSeconds * 1000),
      },
    });
    executionsCreated += 1;
  }

  const unmatched = parsed.cases.length - matched;
  const summary = {
    totals: parsed.totals,
    matched,
    unmatched,
    executionsCreated,
    planCasesCreated,
    planName: plan.name,
    buildName: build.name,
    unmatchedKeys: unmatchedKeys.slice(0, MAX_REPORTED_UNMATCHED),
  };

  const ciImport = await prisma.ciImport.create({
    data: {
      projectId: input.projectId,
      planId: plan.id,
      buildId: build.id,
      source: "junit",
      payloadHash: createHash("sha256").update(input.xml, "utf8").digest("hex"),
      summaryJson: JSON.stringify(summary),
    },
    select: { id: true },
  });

  return {
    importId: ciImport.id,
    planId: plan.id,
    buildId: build.id,
    buildName: build.name,
    buildCreated: build.created,
    totals: parsed.totals,
    matched,
    unmatched,
    executionsCreated,
    planCasesCreated,
    unmatchedKeys: summary.unmatchedKeys,
  };
}

async function resolveBuild(
  planId: string,
  buildId: string | undefined,
  buildName: string | undefined,
): Promise<{ id: string; name: string; created: boolean }> {
  if (buildId) {
    const build = await prisma.build.findFirst({
      where: { id: buildId, planId },
      select: { id: true, name: true },
    });
    if (!build) throw new JUnitImportError("Build not found in this plan");
    return { ...build, created: false };
  }

  const name = buildName?.trim();
  if (!name) throw new JUnitImportError("Provide either buildId or buildName");

  const existing = await prisma.build.findUnique({
    where: { planId_name: { planId, name } },
    select: { id: true, name: true },
  });
  if (existing) return { ...existing, created: false };

  const created = await prisma.build.create({
    data: { planId, name, notes: "Created automatically by CI import" },
    select: { id: true, name: true },
  });
  return { ...created, created: true };
}

function buildNotes(testCase: JUnitTestCase): string {
  const header = `[ci:junit] ${testCase.classname || testCase.suiteName || "suite"} › ${testCase.name}`;
  const note = testCase.message.length > 0 ? `${header}\n${testCase.message}` : header;
  return note.length > MAX_NOTE_LENGTH ? `${note.slice(0, MAX_NOTE_LENGTH - 1)}…` : note;
}
