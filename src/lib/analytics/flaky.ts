import { ExecutionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** How many recent executions per case are inspected when deciding whether a case is flaky. */
export const DEFAULT_SAMPLE_SIZE = 20;
/** Guard rail so a large project cannot pull an unbounded execution history into memory. */
const MAX_ROWS = 5000;

export interface FlakyCase {
  caseId: string;
  externalId: number;
  title: string;
  automationKey: string | null;
  total: number;
  passed: number;
  failed: number;
  /** Share of failures inside the inspected sample, 0–1. */
  failureRate: number;
  /** Number of pass→fail or fail→pass transitions inside the sample. */
  flips: number;
  lastStatus: ExecutionStatus;
  lastExecutedAt: Date;
}

export interface BuildTrendPoint {
  buildId: string;
  buildName: string;
  planId: string;
  createdAt: Date;
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  notRun: number;
  /** Passed divided by all executed (non NOT_RUN) results, 0–1. */
  passRate: number;
}

export interface Regression {
  caseId: string;
  externalId: number;
  title: string;
  previousStatus: ExecutionStatus;
  latestStatus: ExecutionStatus;
}

export interface BuildRef {
  buildId: string;
  buildName: string;
}

export interface FlakyReport {
  sampleSize: number;
  flaky: FlakyCase[];
  trend: BuildTrendPoint[];
  regressions: Regression[];
  latestBuild: BuildRef | null;
  previousBuild: BuildRef | null;
}

export interface FlakyReportOptions {
  sampleSize?: number;
  planId?: string;
}

interface ExecutionRow {
  status: ExecutionStatus;
  executedAt: Date;
  buildId: string;
  buildName: string;
  buildCreatedAt: Date;
  planId: string;
  caseId: string;
  externalId: number;
  title: string;
  automationKey: string | null;
}

async function loadExecutions(
  projectId: string,
  planId: string | undefined,
): Promise<ExecutionRow[]> {
  const rows = await prisma.execution.findMany({
    where: {
      planCase: {
        plan: { projectId, ...(planId ? { id: planId } : {}) },
      },
    },
    orderBy: { executedAt: "desc" },
    take: MAX_ROWS,
    select: {
      status: true,
      executedAt: true,
      buildId: true,
      build: { select: { name: true, createdAt: true, planId: true } },
      planCase: {
        select: {
          case: { select: { id: true, externalId: true, title: true, automationKey: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    status: row.status,
    executedAt: row.executedAt,
    buildId: row.buildId,
    buildName: row.build.name,
    buildCreatedAt: row.build.createdAt,
    planId: row.build.planId,
    caseId: row.planCase.case.id,
    externalId: row.planCase.case.externalId,
    title: row.planCase.case.title,
    automationKey: row.planCase.case.automationKey,
  }));
}

export async function getFlakyReport(
  projectId: string,
  options: FlakyReportOptions = {},
): Promise<FlakyReport> {
  const sampleSize = Math.max(2, Math.min(options.sampleSize ?? DEFAULT_SAMPLE_SIZE, 200));
  const rows = await loadExecutions(projectId, options.planId);

  const flaky = computeFlakyCases(rows, sampleSize);
  const trend = computeBuildTrend(rows);
  const { regressions, latestBuild, previousBuild } = computeRegressions(rows, trend);

  return { sampleSize, flaky, trend, regressions, latestBuild, previousBuild };
}

/** Rows must be sorted newest first. */
export function computeFlakyCases(rows: ExecutionRow[], sampleSize: number): FlakyCase[] {
  const byCase = new Map<string, ExecutionRow[]>();
  for (const row of rows) {
    const bucket = byCase.get(row.caseId);
    if (bucket === undefined) {
      byCase.set(row.caseId, [row]);
    } else if (bucket.length < sampleSize) {
      bucket.push(row);
    }
  }

  const flaky: FlakyCase[] = [];
  for (const sample of byCase.values()) {
    const passed = sample.filter((row) => row.status === ExecutionStatus.PASSED).length;
    const failed = sample.filter((row) => row.status === ExecutionStatus.FAILED).length;
    if (passed === 0 || failed === 0) continue;

    const decisive = sample.filter(
      (row) => row.status === ExecutionStatus.PASSED || row.status === ExecutionStatus.FAILED,
    );
    let flips = 0;
    for (let index = 1; index < decisive.length; index += 1) {
      if (decisive[index].status !== decisive[index - 1].status) flips += 1;
    }

    const newest = sample[0];
    flaky.push({
      caseId: newest.caseId,
      externalId: newest.externalId,
      title: newest.title,
      automationKey: newest.automationKey,
      total: sample.length,
      passed,
      failed,
      failureRate: failed / sample.length,
      flips,
      lastStatus: newest.status,
      lastExecutedAt: newest.executedAt,
    });
  }

  return flaky.sort((a, b) => b.flips - a.flips || b.failureRate - a.failureRate);
}

/** One point per build, using each case's latest result inside that build. */
export function computeBuildTrend(rows: ExecutionRow[]): BuildTrendPoint[] {
  const builds = new Map<
    string,
    { name: string; planId: string; createdAt: Date; latestByCase: Map<string, ExecutionRow> }
  >();

  for (const row of rows) {
    let build = builds.get(row.buildId);
    if (!build) {
      build = {
        name: row.buildName,
        planId: row.planId,
        createdAt: row.buildCreatedAt,
        latestByCase: new Map(),
      };
      builds.set(row.buildId, build);
    }
    // Rows arrive newest first, so the first entry per case is the one that counts.
    if (!build.latestByCase.has(row.caseId)) build.latestByCase.set(row.caseId, row);
  }

  const points: BuildTrendPoint[] = [];
  for (const [buildId, build] of builds) {
    const results = [...build.latestByCase.values()];
    const count = (status: ExecutionStatus) =>
      results.filter((row) => row.status === status).length;

    const passed = count(ExecutionStatus.PASSED);
    const notRun = count(ExecutionStatus.NOT_RUN);
    const executed = results.length - notRun;

    points.push({
      buildId,
      buildName: build.name,
      planId: build.planId,
      createdAt: build.createdAt,
      total: results.length,
      passed,
      failed: count(ExecutionStatus.FAILED),
      blocked: count(ExecutionStatus.BLOCKED),
      skipped: count(ExecutionStatus.SKIPPED),
      notRun,
      passRate: executed === 0 ? 0 : passed / executed,
    });
  }

  return points.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function computeRegressions(
  rows: ExecutionRow[],
  trend: BuildTrendPoint[],
): { regressions: Regression[]; latestBuild: BuildRef | null; previousBuild: BuildRef | null } {
  if (trend.length === 0) {
    return { regressions: [], latestBuild: null, previousBuild: null };
  }

  const latest = trend[trend.length - 1];
  const previous = trend.length > 1 ? trend[trend.length - 2] : null;
  const latestRef: BuildRef = { buildId: latest.buildId, buildName: latest.buildName };
  if (!previous) {
    return { regressions: [], latestBuild: latestRef, previousBuild: null };
  }

  const statusIn = (buildId: string): Map<string, ExecutionRow> => {
    const map = new Map<string, ExecutionRow>();
    for (const row of rows) {
      if (row.buildId !== buildId) continue;
      if (!map.has(row.caseId)) map.set(row.caseId, row);
    }
    return map;
  };

  const previousResults = statusIn(previous.buildId);
  const latestResults = statusIn(latest.buildId);

  const regressions: Regression[] = [];
  for (const [caseId, latestRow] of latestResults) {
    if (latestRow.status !== ExecutionStatus.FAILED) continue;
    const previousRow = previousResults.get(caseId);
    if (previousRow?.status !== ExecutionStatus.PASSED) continue;

    regressions.push({
      caseId,
      externalId: latestRow.externalId,
      title: latestRow.title,
      previousStatus: previousRow.status,
      latestStatus: latestRow.status,
    });
  }

  return {
    regressions: regressions.sort((a, b) => a.externalId - b.externalId),
    latestBuild: latestRef,
    previousBuild: { buildId: previous.buildId, buildName: previous.buildName },
  };
}
