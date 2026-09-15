import { createHash, randomBytes } from "node:crypto";
import {
  ActivityType,
  ExecutionStatus,
  ExecutionType,
  Importance,
  IssueProvider,
  PrismaClient,
  ReviewStatus,
  Role,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Mirrors `src/lib/api-keys.ts`: only the hash and a lookup prefix are ever stored. */
function sampleApiKey(): { token: string; keyHash: string; keyPrefix: string } {
  const token = `ttk_${randomBytes(24).toString("hex")}`;
  return {
    token,
    keyHash: createHash("sha256").update(token, "utf8").digest("hex"),
    keyPrefix: token.slice(0, 12),
  };
}

function daysAgo(days: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function main() {
  // Newest relations first so foreign keys never block a delete.
  await prisma.mention.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.issueLink.deleteMany();
  await prisma.ciImport.deleteMany();
  await prisma.automationMapping.deleteMany();
  await prisma.caseDataset.deleteMany();
  await prisma.customFieldValue.deleteMany();
  await prisma.presence.deleteMany();
  await prisma.savedView.deleteMany();
  await prisma.exploratorySession.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.execution.deleteMany();
  await prisma.planTestCase.deleteMany();
  await prisma.requirementCoverage.deleteMany();
  await prisma.caseKeyword.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.testSuite.deleteMany();
  await prisma.build.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.planPlatform.deleteMany();
  await prisma.platform.deleteMany();
  await prisma.testPlan.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.customField.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.testProject.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@testtick.app",
      name: "Admin User",
      passwordHash,
      role: Role.ADMINISTRATOR,
      locale: "en",
      theme: "light",
    },
  });

  const tester = await prisma.user.create({
    data: {
      email: "tester@testtick.app",
      name: "Sara Tester",
      passwordHash: await bcrypt.hash("tester123", 10),
      role: Role.TESTER,
      locale: "fa",
      theme: "dark",
    },
  });

  const designer = await prisma.user.create({
    data: {
      email: "designer@testtick.app",
      name: "Ali Designer",
      passwordHash: await bcrypt.hash("designer123", 10),
      role: Role.TEST_DESIGNER,
      locale: "fa",
      theme: "system",
    },
  });

  const project = await prisma.testProject.create({
    data: {
      name: "TestTick Demo Store",
      prefix: "TTS",
      description:
        "Sample e-commerce product used to showcase TestTick workflows: specs, plans, execution, and requirements.",
      members: {
        create: [
          { userId: admin.id, role: Role.ADMINISTRATOR },
          { userId: tester.id, role: Role.TESTER },
          { userId: designer.id, role: Role.TEST_DESIGNER },
        ],
      },
    },
  });

  const authSuite = await prisma.testSuite.create({
    data: {
      name: "Authentication",
      description: "Login, logout, and session flows",
      projectId: project.id,
      authorId: designer.id,
      orderIndex: 1,
    },
  });

  const cartSuite = await prisma.testSuite.create({
    data: {
      name: "Shopping Cart",
      description: "Cart mutations and checkout readiness",
      projectId: project.id,
      authorId: designer.id,
      orderIndex: 2,
    },
  });

  const cases = await Promise.all([
    prisma.testCase.create({
      data: {
        externalId: 1,
        title: "Valid user can sign in",
        summary: "Happy-path login with correct credentials",
        preconditions: "A registered active user exists",
        steps: "1. Open /login\n2. Enter valid email and password\n3. Submit",
        expectedResult: "User lands on dashboard and session cookie is set",
        importance: Importance.HIGH,
        executionType: ExecutionType.AUTOMATED,
        reviewStatus: ReviewStatus.APPROVED,
        automationKey: "auth.login.valid_credentials",
        projectId: project.id,
        suiteId: authSuite.id,
        authorId: designer.id,
        reviewerId: admin.id,
      },
    }),
    prisma.testCase.create({
      data: {
        externalId: 2,
        title: "Invalid password is rejected",
        summary: "Negative login case",
        preconditions: "User account exists",
        steps: "1. Open /login\n2. Enter valid email and wrong password\n3. Submit",
        expectedResult: "Error message shown; user remains on login",
        importance: Importance.MEDIUM,
        executionType: ExecutionType.AUTOMATED,
        reviewStatus: ReviewStatus.APPROVED,
        projectId: project.id,
        suiteId: authSuite.id,
        authorId: designer.id,
        reviewerId: admin.id,
      },
    }),
    prisma.testCase.create({
      data: {
        externalId: 3,
        title: "Add product to cart",
        summary: "Cart increases quantity",
        preconditions: "Catalog has at least one product",
        steps: "1. Open product page\n2. Click Add to cart\n3. Open cart drawer",
        expectedResult: "Product appears with quantity 1 and correct price",
        importance: Importance.HIGH,
        executionType: ExecutionType.AUTOMATED,
        reviewStatus: ReviewStatus.IN_REVIEW,
        automationKey: "cart.add_to_cart",
        projectId: project.id,
        suiteId: cartSuite.id,
        authorId: designer.id,
        reviewerId: tester.id,
      },
    }),
    prisma.testCase.create({
      data: {
        externalId: 4,
        title: "Remove item from cart",
        summary: "Cart empties after remove",
        preconditions: "Cart contains one item",
        steps: "1. Open cart\n2. Click remove\n3. Confirm",
        expectedResult: "Cart shows empty state",
        importance: Importance.LOW,
        executionType: ExecutionType.MANUAL,
        projectId: project.id,
        suiteId: cartSuite.id,
        authorId: designer.id,
      },
    }),
  ]);

  // The second login case is mapped explicitly instead of through TestCase.automationKey,
  // which exercises both lookup paths of the JUnit importer.
  await prisma.automationMapping.create({
    data: {
      projectId: project.id,
      caseId: cases[1].id,
      automationKey: "auth.login.invalid_password",
    },
  });

  await prisma.caseDataset.create({
    data: {
      caseId: cases[2].id,
      name: "Cart quantities",
      rowsJson: JSON.stringify([
        { product: "Teal Mug", quantity: "1", expectedTotal: "12.00" },
        { product: "Teal Mug", quantity: "3", expectedTotal: "36.00" },
        { product: "Notebook", quantity: "2", expectedTotal: "18.50" },
      ]),
    },
  });

  const web = await prisma.platform.create({
    data: { name: "Web Chrome", description: "Desktop Chrome latest", projectId: project.id },
  });
  const mobile = await prisma.platform.create({
    data: { name: "Mobile Safari", description: "iOS Safari", projectId: project.id },
  });

  const plan = await prisma.testPlan.create({
    data: {
      name: "Release 1.0 Regression",
      description: "Core smoke + regression for first customer release",
      projectId: project.id,
      authorId: admin.id,
      reviewStatus: ReviewStatus.APPROVED,
      reviewerId: admin.id,
      platforms: {
        create: [{ platformId: web.id }, { platformId: mobile.id }],
      },
      milestones: {
        create: [{ name: "RC freeze", targetDate: new Date("2026-10-01") }],
      },
    },
  });

  // Explicit creation dates keep the build order (and therefore the trend chart and
  // regression detection) deterministic on every reseed.
  const rc1 = await prisma.build.create({
    data: {
      planId: plan.id,
      name: "1.0.0-rc1",
      notes: "First release candidate",
      isOpen: true,
      createdAt: daysAgo(6, 9),
    },
  });
  const ga = await prisma.build.create({
    data: {
      planId: plan.id,
      name: "1.0.0",
      notes: "GA build",
      isOpen: true,
      createdAt: daysAgo(2, 9),
    },
  });

  const planCases = await Promise.all(
    cases.map((testCase, index) =>
      prisma.planTestCase.create({
        data: {
          planId: plan.id,
          caseId: testCase.id,
          assigneeId: index % 2 === 0 ? tester.id : designer.id,
          priority: testCase.importance,
        },
      }),
    ),
  );

  await prisma.execution.createMany({
    data: [
      // Release candidate run.
      {
        planCaseId: planCases[0].id,
        buildId: rc1.id,
        platformId: web.id,
        executorId: tester.id,
        status: ExecutionStatus.PASSED,
        notes: "Login works on Chrome",
        source: "manual",
        executedAt: daysAgo(6, 11),
      },
      {
        planCaseId: planCases[1].id,
        buildId: rc1.id,
        platformId: web.id,
        executorId: tester.id,
        status: ExecutionStatus.PASSED,
        notes: "Error banner visible",
        source: "manual",
        executedAt: daysAgo(6, 12),
      },
      {
        planCaseId: planCases[2].id,
        buildId: rc1.id,
        platformId: mobile.id,
        executorId: designer.id,
        status: ExecutionStatus.FAILED,
        notes: "Quantity badge not updating on iOS",
        source: "manual",
        datasetRow: JSON.stringify({ product: "Teal Mug", quantity: "3", expectedTotal: "36.00" }),
        executedAt: daysAgo(6, 13),
      },
      {
        planCaseId: planCases[3].id,
        buildId: rc1.id,
        platformId: web.id,
        executorId: tester.id,
        status: ExecutionStatus.PASSED,
        notes: "Cart empties as expected",
        source: "manual",
        executedAt: daysAgo(6, 14),
      },
      // Nightly CI runs on the cart case flip between pass and fail, which is what the
      // flaky detector looks for.
      {
        planCaseId: planCases[2].id,
        buildId: rc1.id,
        status: ExecutionStatus.PASSED,
        notes: "[ci:junit] cart › add_to_cart",
        source: "ci",
        duration: 4120,
        executedAt: daysAgo(5, 3),
      },
      {
        planCaseId: planCases[2].id,
        buildId: rc1.id,
        status: ExecutionStatus.FAILED,
        notes: "[ci:junit] cart › add_to_cart\nAssertionError: expected badge to show 1",
        source: "ci",
        duration: 5210,
        executedAt: daysAgo(4, 3),
      },
      {
        planCaseId: planCases[2].id,
        buildId: rc1.id,
        status: ExecutionStatus.PASSED,
        notes: "[ci:junit] cart › add_to_cart",
        source: "ci",
        duration: 3980,
        executedAt: daysAgo(3, 3),
      },
      // GA run: the negative login case regresses against the previous build.
      {
        planCaseId: planCases[0].id,
        buildId: ga.id,
        status: ExecutionStatus.PASSED,
        notes: "[ci:junit] auth.login › valid_credentials",
        source: "ci",
        duration: 2310,
        executedAt: daysAgo(2, 3),
      },
      {
        planCaseId: planCases[1].id,
        buildId: ga.id,
        status: ExecutionStatus.FAILED,
        notes:
          "[ci:junit] auth.login › invalid_password\nAssertionError: expected error banner, found redirect to /dashboard",
        source: "ci",
        duration: 2890,
        executedAt: daysAgo(2, 3),
      },
      {
        planCaseId: planCases[2].id,
        buildId: ga.id,
        status: ExecutionStatus.PASSED,
        notes: "[ci:junit] cart › add_to_cart",
        source: "ci",
        duration: 4050,
        executedAt: daysAgo(2, 3),
      },
      {
        planCaseId: planCases[3].id,
        buildId: ga.id,
        platformId: mobile.id,
        executorId: tester.id,
        status: ExecutionStatus.PASSED,
        notes: "Verified on iOS Safari",
        source: "manual",
        executedAt: daysAgo(1, 15),
      },
    ],
  });

  const failedCartExecution = await prisma.execution.findFirst({
    where: { planCaseId: planCases[2].id, buildId: rc1.id, status: ExecutionStatus.FAILED },
    orderBy: { executedAt: "asc" },
    select: { id: true },
  });
  const failedLoginExecution = await prisma.execution.findFirst({
    where: { planCaseId: planCases[1].id, buildId: ga.id, status: ExecutionStatus.FAILED },
    select: { id: true },
  });

  await prisma.ciImport.create({
    data: {
      projectId: project.id,
      planId: plan.id,
      buildId: ga.id,
      source: "junit",
      payloadHash: createHash("sha256").update("seed-junit-report", "utf8").digest("hex"),
      summaryJson: JSON.stringify({
        totals: { total: 3, passed: 2, failed: 1, skipped: 0 },
        matched: 3,
        unmatched: 0,
        executionsCreated: 3,
        planCasesCreated: 0,
        planName: plan.name,
        buildName: ga.name,
        unmatchedKeys: [],
      }),
      createdAt: daysAgo(2, 4),
    },
  });

  const req1 = await prisma.requirement.create({
    data: {
      docId: "REQ-AUTH-01",
      title: "Secure authentication",
      scope: "Users must authenticate with email and password",
      status: "Approved",
      projectId: project.id,
      authorId: admin.id,
    },
  });
  const req2 = await prisma.requirement.create({
    data: {
      docId: "REQ-CART-01",
      title: "Cart management",
      scope: "Shoppers can add and remove products",
      status: "Approved",
      projectId: project.id,
      authorId: admin.id,
    },
  });

  await prisma.requirementCoverage.createMany({
    data: [
      { requirementId: req1.id, caseId: cases[0].id },
      { requirementId: req1.id, caseId: cases[1].id },
      { requirementId: req2.id, caseId: cases[2].id },
      { requirementId: req2.id, caseId: cases[3].id },
    ],
  });

  const componentField = await prisma.customField.create({
    data: {
      name: "component",
      label: "Component",
      fieldType: "string",
      appliesTo: "testcase",
      projectId: project.id,
    },
  });
  const riskField = await prisma.customField.create({
    data: {
      name: "risk",
      label: "Risk level",
      fieldType: "list",
      options: "Low,Medium,High",
      appliesTo: "testcase",
      required: false,
      projectId: project.id,
    },
  });

  await prisma.customFieldValue.createMany({
    data: [
      { fieldId: componentField.id, caseId: cases[0].id, value: "Auth", userId: designer.id },
      { fieldId: componentField.id, caseId: cases[2].id, value: "Cart", userId: designer.id },
      { fieldId: riskField.id, caseId: cases[0].id, value: "High", userId: admin.id },
      { fieldId: riskField.id, caseId: cases[2].id, value: "High", userId: admin.id },
      { fieldId: riskField.id, caseId: cases[3].id, value: "Low", userId: tester.id },
    ],
  });

  await prisma.activity.create({
    data: {
      projectId: project.id,
      authorId: admin.id,
      type: ActivityType.STATUS_CHANGE,
      caseId: cases[0].id,
      body: "Review status changed from IN_REVIEW to APPROVED\nSteps and expected result match REQ-AUTH-01.",
      createdAt: daysAgo(7, 16),
    },
  });

  await prisma.activity.create({
    data: {
      projectId: project.id,
      authorId: tester.id,
      type: ActivityType.COMMENT,
      caseId: cases[2].id,
      body: "@Ali Designer the quantity badge never updates on iOS Safari. Should the expected result mention the badge explicitly?",
      createdAt: daysAgo(5, 10),
      mentions: { create: [{ userId: designer.id }] },
    },
  });

  await prisma.activity.create({
    data: {
      projectId: project.id,
      authorId: designer.id,
      type: ActivityType.COMMENT,
      caseId: cases[2].id,
      body: "Good catch — I added the badge to the expected result. @sara please rerun on the GA build.",
      createdAt: daysAgo(4, 11),
      mentions: { create: [{ userId: tester.id }] },
    },
  });

  if (failedCartExecution) {
    await prisma.activity.create({
      data: {
        projectId: project.id,
        authorId: tester.id,
        type: ActivityType.COMMENT,
        executionId: failedCartExecution.id,
        body: "@admin@testtick.app this is the blocker for the RC sign-off. Issue is linked.",
        createdAt: daysAgo(5, 12),
        mentions: { create: [{ userId: admin.id }] },
      },
    });

    await prisma.issueLink.create({
      data: {
        projectId: project.id,
        caseId: cases[2].id,
        executionId: failedCartExecution.id,
        createdById: tester.id,
        provider: IssueProvider.GITHUB,
        externalId: "412",
        url: "https://github.com/testtick/demo-store/issues/412",
        title: "Cart badge does not update on iOS Safari",
        createdAt: daysAgo(5, 12),
      },
    });
  }

  if (failedLoginExecution) {
    await prisma.activity.create({
      data: {
        projectId: project.id,
        authorId: admin.id,
        type: ActivityType.EXECUTION,
        executionId: failedLoginExecution.id,
        body: "Regression on the GA build: invalid password now redirects to the dashboard.",
        createdAt: daysAgo(2, 5),
      },
    });
  }

  await prisma.savedView.create({
    data: {
      projectId: project.id,
      ownerId: admin.id,
      name: "High risk automated cases",
      entity: "cases",
      shared: true,
      filtersJson: JSON.stringify({ importance: "HIGH", executionType: "AUTOMATED" }),
    },
  });

  await prisma.exploratorySession.create({
    data: {
      projectId: project.id,
      ownerId: tester.id,
      charter: "Explore checkout with expired and stacked discount codes",
      mission:
        "Look for pricing errors when a discount code expires mid-session or is applied twice.",
      durationMin: 45,
      status: "active",
      startedAt: new Date(Date.now() - 12 * 60_000),
      notes: [
        "[00:03] Expired code shows a generic error instead of naming the code.",
        "[00:08] Applying the same code twice doubles the discount in the summary panel.",
      ].join("\n"),
    },
  });

  const apiKey = sampleApiKey();
  await prisma.apiKey.create({
    data: {
      projectId: project.id,
      ownerId: admin.id,
      name: "CI pipeline (GitHub Actions)",
      keyHash: apiKey.keyHash,
      keyPrefix: apiKey.keyPrefix,
      createdAt: daysAgo(8, 9),
      lastUsedAt: daysAgo(2, 3),
    },
  });

  console.log("Seed complete.");
  console.log("Admin: admin@testtick.app / admin123");
  console.log("Tester: tester@testtick.app / tester123");
  console.log("Designer: designer@testtick.app / designer123");
  console.log(`Sample API key (stored hashed, shown once): ${apiKey.token}`);
  console.log(`Plan id: ${plan.id} · builds: ${rc1.name}, ${ga.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
