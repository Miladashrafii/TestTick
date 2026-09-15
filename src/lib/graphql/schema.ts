import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import { ActivityType, ExecutionStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessProject, type ApiActor } from "@/lib/api/actor";
import { getFlakyReport } from "@/lib/analytics/flaky";
import { recordActivity } from "@/lib/activity";
import { findMentionedUserIds } from "@/lib/mentions";

export interface GraphQLContext {
  actor: ApiActor | null;
}

const typeDefs = /* GraphQL */ `
  type Project {
    id: ID!
    name: String!
    prefix: String!
    description: String!
    status: String!
    createdAt: String!
    caseCount: Int!
    planCount: Int!
    cases(limit: Int, offset: Int, suiteId: ID): [TestCase!]!
    plans: [TestPlan!]!
    executions(limit: Int, planId: ID): [Execution!]!
  }

  type TestCase {
    id: ID!
    externalId: Int!
    title: String!
    summary: String!
    preconditions: String!
    steps: String!
    expectedResult: String!
    importance: String!
    executionType: String!
    reviewStatus: String!
    automationKey: String
    version: Int!
    projectId: ID!
    suiteId: ID!
    suiteName: String!
    createdAt: String!
    updatedAt: String!
  }

  type TestPlan {
    id: ID!
    name: String!
    description: String!
    active: Boolean!
    reviewStatus: String!
    projectId: ID!
    caseCount: Int!
    buildCount: Int!
    createdAt: String!
  }

  type Execution {
    id: ID!
    status: String!
    notes: String!
    source: String!
    duration: Int
    executedAt: String!
    buildId: ID!
    buildName: String!
    planId: ID!
    platform: String
    executor: String
    caseId: ID!
    caseExternalId: Int!
    caseTitle: String!
  }

  type FlakyCase {
    caseId: ID!
    externalId: Int!
    title: String!
    total: Int!
    passed: Int!
    failed: Int!
    failureRate: Float!
    flips: Int!
    lastStatus: String!
  }

  type Comment {
    id: ID!
    type: String!
    body: String!
    createdAt: String!
    mentionedUserIds: [ID!]!
  }

  type Query {
    projects: [Project!]!
    project(id: ID!): Project
    testCases(projectId: ID!, suiteId: ID, limit: Int, offset: Int): [TestCase!]!
    testCase(id: ID!): TestCase
    testPlans(projectId: ID!, active: Boolean): [TestPlan!]!
    executions(projectId: ID!, planId: ID, status: String, limit: Int): [Execution!]!
    flakyCases(projectId: ID!, sampleSize: Int): [FlakyCase!]!
  }

  type Mutation {
    createComment(
      projectId: ID!
      body: String!
      caseId: ID
      planId: ID
      executionId: ID
      requirementId: ID
    ): Comment!
  }
`;

interface ProjectParent {
  id: string;
  name: string;
  prefix: string;
  description: string;
  status: string;
  createdAt: Date;
  caseCount: number;
  planCount: number;
}

interface TestCaseParent {
  id: string;
  externalId: number;
  title: string;
  summary: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  importance: string;
  executionType: string;
  reviewStatus: string;
  automationKey: string | null;
  version: number;
  projectId: string;
  suiteId: string;
  suiteName: string;
  createdAt: string;
  updatedAt: string;
}

interface TestPlanParent {
  id: string;
  name: string;
  description: string;
  active: boolean;
  reviewStatus: string;
  projectId: string;
  caseCount: number;
  buildCount: number;
  createdAt: string;
}

interface ExecutionParent {
  id: string;
  status: string;
  notes: string;
  source: string;
  duration: number | null;
  executedAt: string;
  buildId: string;
  buildName: string;
  planId: string;
  platform: string | null;
  executor: string | null;
  caseId: string;
  caseExternalId: number;
  caseTitle: string;
}

function requireActor(context: GraphQLContext): ApiActor {
  if (!context.actor) {
    throw new GraphQLError("Authentication required", {
      extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
    });
  }
  return context.actor;
}

async function requireProject(context: GraphQLContext, projectId: string): Promise<ApiActor> {
  const actor = requireActor(context);
  if (!(await canAccessProject(actor, projectId))) {
    throw new GraphQLError("Not allowed for this project", {
      extensions: { code: "FORBIDDEN", http: { status: 403 } },
    });
  }
  return actor;
}

function clampLimit(limit: number | null | undefined, fallback = 50): number {
  if (limit === null || limit === undefined) return fallback;
  return Math.min(Math.max(limit, 1), 200);
}

type TestCaseWithSuite = Prisma.TestCaseGetPayload<{
  include: { suite: { select: { name: true } } };
}>;

function toCaseParent(testCase: TestCaseWithSuite): TestCaseParent {
  return {
    id: testCase.id,
    externalId: testCase.externalId,
    title: testCase.title,
    summary: testCase.summary,
    preconditions: testCase.preconditions,
    steps: testCase.steps,
    expectedResult: testCase.expectedResult,
    importance: testCase.importance,
    executionType: testCase.executionType,
    reviewStatus: testCase.reviewStatus,
    automationKey: testCase.automationKey,
    version: testCase.version,
    projectId: testCase.projectId,
    suiteId: testCase.suiteId,
    suiteName: testCase.suite.name,
    createdAt: testCase.createdAt.toISOString(),
    updatedAt: testCase.updatedAt.toISOString(),
  };
}

async function loadCases(args: {
  projectId: string;
  suiteId?: string | null;
  limit?: number | null;
  offset?: number | null;
}): Promise<TestCaseParent[]> {
  const cases = await prisma.testCase.findMany({
    where: { projectId: args.projectId, ...(args.suiteId ? { suiteId: args.suiteId } : {}) },
    orderBy: { externalId: "asc" },
    take: clampLimit(args.limit),
    skip: args.offset && args.offset > 0 ? args.offset : 0,
    include: { suite: { select: { name: true } } },
  });

  return cases.map(toCaseParent);
}

async function loadPlans(projectId: string, active?: boolean | null): Promise<TestPlanParent[]> {
  const plans = await prisma.testPlan.findMany({
    where: { projectId, ...(active === null || active === undefined ? {} : { active }) },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cases: true, builds: true } } },
  });

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    active: plan.active,
    reviewStatus: plan.reviewStatus,
    projectId: plan.projectId,
    caseCount: plan._count.cases,
    buildCount: plan._count.builds,
    createdAt: plan.createdAt.toISOString(),
  }));
}

async function loadExecutions(args: {
  projectId: string;
  planId?: string | null;
  status?: string | null;
  limit?: number | null;
}): Promise<ExecutionParent[]> {
  const status = Object.values(ExecutionStatus).find(
    (candidate) => candidate === args.status?.toUpperCase(),
  );

  const where: Prisma.ExecutionWhereInput = {
    planCase: { plan: { projectId: args.projectId, ...(args.planId ? { id: args.planId } : {}) } },
    ...(status ? { status } : {}),
  };

  const executions = await prisma.execution.findMany({
    where,
    orderBy: { executedAt: "desc" },
    take: clampLimit(args.limit),
    include: {
      build: { select: { id: true, name: true, planId: true } },
      platform: { select: { name: true } },
      executor: { select: { name: true } },
      planCase: { select: { caseId: true, case: { select: { externalId: true, title: true } } } },
    },
  });

  return executions.map((execution) => ({
    id: execution.id,
    status: execution.status,
    notes: execution.notes,
    source: execution.source,
    duration: execution.duration,
    executedAt: execution.executedAt.toISOString(),
    buildId: execution.buildId,
    buildName: execution.build.name,
    planId: execution.build.planId,
    platform: execution.platform?.name ?? null,
    executor: execution.executor?.name ?? null,
    caseId: execution.planCase.caseId,
    caseExternalId: execution.planCase.case.externalId,
    caseTitle: execution.planCase.case.title,
  }));
}

export const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    Query: {
      projects: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
        const actor = requireActor(context);
        const where =
          actor.kind === "apiKey"
            ? { id: actor.projectId }
            : actor.role === Role.ADMINISTRATOR
              ? {}
              : { members: { some: { userId: actor.userId } } };

        const projects = await prisma.testProject.findMany({
          where,
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { cases: true, plans: true } } },
        });

        return projects.map(
          (project): ProjectParent => ({
            id: project.id,
            name: project.name,
            prefix: project.prefix,
            description: project.description,
            status: project.status,
            createdAt: project.createdAt,
            caseCount: project._count.cases,
            planCount: project._count.plans,
          }),
        );
      },

      project: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
        await requireProject(context, args.id);
        const project = await prisma.testProject.findUnique({
          where: { id: args.id },
          include: { _count: { select: { cases: true, plans: true } } },
        });
        if (!project) return null;

        const parent: ProjectParent = {
          id: project.id,
          name: project.name,
          prefix: project.prefix,
          description: project.description,
          status: project.status,
          createdAt: project.createdAt,
          caseCount: project._count.cases,
          planCount: project._count.plans,
        };
        return parent;
      },

      testCases: async (
        _parent: unknown,
        args: { projectId: string; suiteId?: string | null; limit?: number | null; offset?: number | null },
        context: GraphQLContext,
      ) => {
        await requireProject(context, args.projectId);
        return loadCases(args);
      },

      testCase: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
        const testCase = await prisma.testCase.findUnique({
          where: { id: args.id },
          include: { suite: { select: { name: true } } },
        });
        if (!testCase) return null;

        await requireProject(context, testCase.projectId);
        return toCaseParent(testCase);
      },

      testPlans: async (
        _parent: unknown,
        args: { projectId: string; active?: boolean | null },
        context: GraphQLContext,
      ) => {
        await requireProject(context, args.projectId);
        return loadPlans(args.projectId, args.active);
      },

      executions: async (
        _parent: unknown,
        args: { projectId: string; planId?: string | null; status?: string | null; limit?: number | null },
        context: GraphQLContext,
      ) => {
        await requireProject(context, args.projectId);
        return loadExecutions(args);
      },

      flakyCases: async (
        _parent: unknown,
        args: { projectId: string; sampleSize?: number | null },
        context: GraphQLContext,
      ) => {
        await requireProject(context, args.projectId);
        const report = await getFlakyReport(args.projectId, {
          sampleSize: args.sampleSize ?? undefined,
        });
        return report.flaky.map((entry) => ({
          caseId: entry.caseId,
          externalId: entry.externalId,
          title: entry.title,
          total: entry.total,
          passed: entry.passed,
          failed: entry.failed,
          failureRate: entry.failureRate,
          flips: entry.flips,
          lastStatus: entry.lastStatus,
        }));
      },
    },

    Project: {
      createdAt: (parent: ProjectParent) => parent.createdAt.toISOString(),
      cases: (
        parent: ProjectParent,
        args: { limit?: number | null; offset?: number | null; suiteId?: string | null },
      ) => loadCases({ projectId: parent.id, ...args }),
      plans: (parent: ProjectParent) => loadPlans(parent.id),
      executions: (parent: ProjectParent, args: { limit?: number | null; planId?: string | null }) =>
        loadExecutions({ projectId: parent.id, ...args }),
    },

    Mutation: {
      createComment: async (
        _parent: unknown,
        args: {
          projectId: string;
          body: string;
          caseId?: string | null;
          planId?: string | null;
          executionId?: string | null;
          requirementId?: string | null;
        },
        context: GraphQLContext,
      ) => {
        const actor = await requireProject(context, args.projectId);
        if (args.body.trim().length === 0) {
          throw new GraphQLError("Comment body cannot be empty", {
            extensions: { code: "BAD_USER_INPUT", http: { status: 400 } },
          });
        }

        const members = await prisma.projectMember.findMany({
          where: { projectId: args.projectId },
          select: { user: { select: { id: true, name: true, email: true } } },
        });
        const mentionedUserIds = findMentionedUserIds(
          args.body,
          members.map((member) => member.user),
        );

        const activityId = await recordActivity({
          projectId: args.projectId,
          authorId: actor.userId,
          type: ActivityType.COMMENT,
          body: args.body,
          target: {
            caseId: args.caseId ?? null,
            planId: args.planId ?? null,
            executionId: args.executionId ?? null,
            requirementId: args.requirementId ?? null,
          },
          mentionUserIds: mentionedUserIds,
        });

        return {
          id: activityId,
          type: ActivityType.COMMENT,
          body: args.body,
          createdAt: new Date().toISOString(),
          mentionedUserIds,
        };
      },
    },
  },
});
