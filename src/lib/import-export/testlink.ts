import { XMLParser } from "fast-xml-parser";
import { ExecutionType, Importance } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  emptyImportResult,
  loadSuiteTree,
  toReviewStatus,
  writeCaseRecords,
  type CaseRecord,
  type ImportResult,
  type WriteOptions,
} from "@/lib/import-export/case-records";

/** TestLink encodes importance as 1=Low, 2=Medium, 3=High and execution type as 1=Manual, 2=Automated. */
const IMPORTANCE_TO_TESTLINK: Record<Importance, string> = {
  LOW: "1",
  MEDIUM: "2",
  HIGH: "3",
};
const EXECUTION_TYPE_TO_TESTLINK: Record<ExecutionType, string> = {
  MANUAL: "1",
  AUTOMATED: "2",
};

const ATTR_PREFIX = "@_";

type XmlNode = Record<string, unknown>;

function isRecord(value: unknown): value is XmlNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cdata(value: string): string {
  // A CDATA section cannot contain the terminator, so split it across two sections.
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export function splitSteps(steps: string): string[] {
  return steps
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim())
    .filter((line) => line.length > 0);
}

export async function exportTestLinkXml(projectId: string): Promise<string> {
  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    select: { name: true, description: true },
  });
  if (!project) throw new Error("Project not found");

  const suites = await loadSuiteTree(projectId);
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="${escapeXml(project.name)}">`,
    `  <details>${cdata(project.description)}</details>`,
  ];

  for (const suite of suites) {
    lines.push(`  <testsuite name="${escapeXml(suite.name)}">`);
    lines.push(`    <details>${cdata(suite.description)}</details>`);
    for (const testCase of suite.cases) {
      lines.push(...renderTestCase(testCase));
    }
    lines.push("  </testsuite>");
  }

  lines.push("</testsuite>");
  return lines.join("\n");
}

function renderTestCase(testCase: CaseRecord): string[] {
  const steps = splitSteps(testCase.steps);
  const lines = [
    `    <testcase name="${escapeXml(testCase.title)}">`,
    `      <externalid>${testCase.externalId ?? ""}</externalid>`,
    `      <summary>${cdata(testCase.summary)}</summary>`,
    `      <preconditions>${cdata(testCase.preconditions)}</preconditions>`,
    `      <execution_type>${EXECUTION_TYPE_TO_TESTLINK[testCase.executionType]}</execution_type>`,
    `      <importance>${IMPORTANCE_TO_TESTLINK[testCase.importance]}</importance>`,
    `      <status>${escapeXml(testCase.reviewStatus)}</status>`,
  ];

  if (testCase.automationKey) {
    lines.push(`      <automation_key>${cdata(testCase.automationKey)}</automation_key>`);
  }

  lines.push("      <steps>");
  const stepList = steps.length > 0 ? steps : [testCase.title];
  stepList.forEach((action, index) => {
    const isLast = index === stepList.length - 1;
    lines.push(
      "        <step>",
      `          <step_number>${index + 1}</step_number>`,
      `          <actions>${cdata(action)}</actions>`,
      `          <expectedresults>${cdata(isLast ? testCase.expectedResult : "")}</expectedresults>`,
      `          <execution_type>${EXECUTION_TYPE_TO_TESTLINK[testCase.executionType]}</execution_type>`,
      "        </step>",
    );
  });
  lines.push("      </steps>", "    </testcase>");

  return lines;
}

/** TestLink stores rich text, so tags are flattened into plain text on import. */
function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function readText(node: XmlNode, key: string): string {
  const value = node[key];
  if (typeof value === "string") return stripHtml(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (isRecord(value)) {
    const text = value["#text"];
    if (typeof text === "string") return stripHtml(text);
    if (typeof text === "number") return String(text);
  }
  return "";
}

function fromTestLinkImportance(value: string): Importance {
  if (value === "3") return Importance.HIGH;
  if (value === "1") return Importance.LOW;
  return Importance.MEDIUM;
}

function fromTestLinkExecutionType(value: string): ExecutionType {
  return value === "2" ? ExecutionType.AUTOMATED : ExecutionType.MANUAL;
}

export function testLinkXmlToCaseRecords(xml: string): {
  records: CaseRecord[];
  errors: string[];
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    cdataPropName: "#text",
  });

  let document: unknown;
  try {
    document = parser.parse(xml);
  } catch (error) {
    return {
      records: [],
      errors: [`Could not parse XML: ${error instanceof Error ? error.message : "unknown error"}`],
    };
  }
  if (!isRecord(document)) return { records: [], errors: ["XML has no root element"] };

  const records: CaseRecord[] = [];
  const roots = [...asArray(document.testsuite), ...asArray(document.testcases)];
  if (roots.length === 0) {
    return { records: [], errors: ["XML contains no <testsuite> element"] };
  }
  for (const root of roots) {
    collectSuite(root, "", records);
  }

  return {
    records,
    errors: records.length === 0 ? ["XML contains no <testcase> elements"] : [],
  };
}

function readAttr(node: XmlNode, key: string): string {
  const value = node[`${ATTR_PREFIX}${key}`];
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function collectSuite(node: unknown, parentName: string, out: CaseRecord[]): void {
  if (!isRecord(node)) return;

  const name = readAttr(node, "name");
  const suiteName = name.length > 0 ? name : parentName;

  // Cases can sit directly under any suite level, including the project-level wrapper.
  for (const raw of asArray(node.testcase)) {
    const record = toCaseRecord(raw, suiteName);
    if (record) out.push(record);
  }

  for (const child of asArray(node.testsuite)) {
    collectSuite(child, suiteName, out);
  }
}

function toCaseRecord(raw: unknown, suiteName: string): CaseRecord | null {
  if (!isRecord(raw)) return null;
  const title = readAttr(raw, "name") || readText(raw, "name");
  if (title.length === 0) return null;

  const stepNodes = asArray(isRecord(raw.steps) ? raw.steps.step : raw.step);
  const actions: string[] = [];
  const expectations: string[] = [];
  for (const stepNode of stepNodes) {
    if (!isRecord(stepNode)) continue;
    const action = readText(stepNode, "actions");
    const expected = readText(stepNode, "expectedresults");
    if (action.length > 0) actions.push(action);
    if (expected.length > 0) expectations.push(expected);
  }

  const externalIdText = readText(raw, "externalid");
  const externalId = Number.parseInt(externalIdText, 10);

  return {
    externalId: Number.isInteger(externalId) && externalId > 0 ? externalId : null,
    suite: suiteName,
    title,
    summary: readText(raw, "summary"),
    preconditions: readText(raw, "preconditions"),
    steps: actions.map((action, index) => `${index + 1}. ${action}`).join("\n"),
    expectedResult: [...new Set(expectations)].join("\n"),
    importance: fromTestLinkImportance(readText(raw, "importance")),
    executionType: fromTestLinkExecutionType(readText(raw, "execution_type")),
    reviewStatus: toReviewStatus(readText(raw, "status")),
    automationKey: readText(raw, "automation_key") || null,
  };
}

export async function importTestLinkXml(
  projectId: string,
  xml: string,
  options: WriteOptions = {},
): Promise<ImportResult> {
  const { records, errors } = testLinkXmlToCaseRecords(xml);
  if (records.length === 0) return { ...emptyImportResult(), errors };

  const result = await writeCaseRecords(projectId, records, {
    fallbackSuiteName: "TestLink Import",
    ...options,
  });
  return { ...result, errors: [...errors, ...result.errors] };
}
