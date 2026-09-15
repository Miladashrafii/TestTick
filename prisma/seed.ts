import { PrismaClient, Role, Importance, ExecutionType, ExecutionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
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
    },
  });

  const tester = await prisma.user.create({
    data: {
      email: "tester@testtick.app",
      name: "Sara Tester",
      passwordHash: await bcrypt.hash("tester123", 10),
      role: Role.TESTER,
      locale: "fa",
    },
  });

  const designer = await prisma.user.create({
    data: {
      email: "designer@testtick.app",
      name: "Ali Designer",
      passwordHash: await bcrypt.hash("designer123", 10),
      role: Role.TEST_DESIGNER,
      locale: "fa",
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
        executionType: ExecutionType.MANUAL,
        projectId: project.id,
        suiteId: authSuite.id,
        authorId: designer.id,
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
        executionType: ExecutionType.MANUAL,
        projectId: project.id,
        suiteId: authSuite.id,
        authorId: designer.id,
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
        projectId: project.id,
        suiteId: cartSuite.id,
        authorId: designer.id,
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
      platforms: {
        create: [{ platformId: web.id }, { platformId: mobile.id }],
      },
      builds: {
        create: [
          { name: "1.0.0-rc1", notes: "First release candidate", isOpen: true },
          { name: "1.0.0", notes: "GA build", isOpen: true },
        ],
      },
      milestones: {
        create: [{ name: "RC freeze", targetDate: new Date("2026-10-01") }],
      },
    },
    include: { builds: true },
  });

  const planCases = await Promise.all(
    cases.map((c, index) =>
      prisma.planTestCase.create({
        data: {
          planId: plan.id,
          caseId: c.id,
          assigneeId: index % 2 === 0 ? tester.id : designer.id,
          priority: c.importance,
        },
      }),
    ),
  );

  const build = plan.builds[0];
  await prisma.execution.createMany({
    data: [
      {
        planCaseId: planCases[0].id,
        buildId: build.id,
        platformId: web.id,
        executorId: tester.id,
        status: ExecutionStatus.PASSED,
        notes: "Login works on Chrome",
      },
      {
        planCaseId: planCases[1].id,
        buildId: build.id,
        platformId: web.id,
        executorId: tester.id,
        status: ExecutionStatus.PASSED,
        notes: "Error banner visible",
      },
      {
        planCaseId: planCases[2].id,
        buildId: build.id,
        platformId: mobile.id,
        executorId: designer.id,
        status: ExecutionStatus.FAILED,
        notes: "Quantity badge not updating on iOS",
      },
    ],
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

  await prisma.customField.create({
    data: {
      name: "component",
      label: "Component",
      fieldType: "string",
      appliesTo: "testcase",
      projectId: project.id,
    },
  });

  console.log("Seed complete.");
  console.log("Admin: admin@testtick.app / admin123");
  console.log("Tester: tester@testtick.app / tester123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
