import type {
  Execution,
  ExecutionStatus,
  ExecutionType,
  Importance,
  ProjectStatus,
  ReviewStatus,
  TestCase,
  TestPlan,
  TestProject,
} from "@prisma/client";

export interface ProjectCounts {
  cases: number;
  plans: number;
  suites: number;
  requirements: number;
}

export interface ProjectDto {
  id: string;
  name: string;
  prefix: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  counts?: ProjectCounts;
}

export function serializeProject(project: TestProject, counts?: ProjectCounts): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    prefix: project.prefix,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    ...(counts ? { counts } : {}),
  };
}

export interface TestCaseDto {
  id: string;
  externalId: number;
  reference: string | null;
  title: string;
  summary: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  importance: Importance;
  executionType: ExecutionType;
  reviewStatus: ReviewStatus;
  version: number;
  automationKey: string | null;
  projectId: string;
  suiteId: string;
  suiteName?: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeTestCase(
  testCase: TestCase,
  extras: { suiteName?: string; projectPrefix?: string } = {},
): TestCaseDto {
  return {
    id: testCase.id,
    externalId: testCase.externalId,
    reference: extras.projectPrefix
      ? `${extras.projectPrefix}-${testCase.externalId}`
      : null,
    title: testCase.title,
    summary: testCase.summary,
    preconditions: testCase.preconditions,
    steps: testCase.steps,
    expectedResult: testCase.expectedResult,
    importance: testCase.importance,
    executionType: testCase.executionType,
    reviewStatus: testCase.reviewStatus,
    version: testCase.version,
    automationKey: testCase.automationKey,
    projectId: testCase.projectId,
    suiteId: testCase.suiteId,
    ...(extras.suiteName === undefined ? {} : { suiteName: extras.suiteName }),
    createdAt: testCase.createdAt.toISOString(),
    updatedAt: testCase.updatedAt.toISOString(),
  };
}

export interface TestPlanDto {
  id: string;
  name: string;
  description: string;
  active: boolean;
  reviewStatus: ReviewStatus;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  counts?: { cases: number; builds: number; milestones: number };
}

export function serializeTestPlan(
  plan: TestPlan,
  counts?: { cases: number; builds: number; milestones: number },
): TestPlanDto {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    active: plan.active,
    reviewStatus: plan.reviewStatus,
    projectId: plan.projectId,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    ...(counts ? { counts } : {}),
  };
}

export interface ExecutionRelations {
  build: { id: string; name: string; planId: string };
  platform: { name: string } | null;
  executor: { name: string } | null;
  planCase: { caseId: string; case: { externalId: number; title: string } };
}

export interface ExecutionDto {
  id: string;
  status: ExecutionStatus;
  notes: string;
  duration: number | null;
  source: string;
  datasetRow: string | null;
  executedAt: string;
  planId: string;
  buildId: string;
  buildName: string;
  platform: string | null;
  executor: string | null;
  caseId: string;
  caseExternalId: number;
  caseTitle: string;
}

export function serializeExecution(execution: Execution & ExecutionRelations): ExecutionDto {
  return {
    id: execution.id,
    status: execution.status,
    notes: execution.notes,
    duration: execution.duration,
    source: execution.source,
    datasetRow: execution.datasetRow,
    executedAt: execution.executedAt.toISOString(),
    planId: execution.build.planId,
    buildId: execution.buildId,
    buildName: execution.build.name,
    platform: execution.platform?.name ?? null,
    executor: execution.executor?.name ?? null,
    caseId: execution.planCase.caseId,
    caseExternalId: execution.planCase.case.externalId,
    caseTitle: execution.planCase.case.title,
  };
}
