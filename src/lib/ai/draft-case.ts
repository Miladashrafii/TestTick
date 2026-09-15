import { z } from "zod";

export type DraftLocale = "en" | "fa";

export interface DraftTestCaseInput {
  prompt: string;
  locale?: string;
}

export interface DraftedTestCase {
  title: string;
  summary: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  /** Which engine produced the draft, so the UI can label it. */
  source: "openai" | "heuristic";
}

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_TIMEOUT_MS = 20_000;

const draftSchema = z.object({
  title: z.string().min(1),
  summary: z.string().default(""),
  preconditions: z.string().default(""),
  steps: z.string().default(""),
  expectedResult: z.string().default(""),
});

const openAiResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
});

function toDraftLocale(locale: string | undefined): DraftLocale {
  return locale === "fa" ? "fa" : "en";
}

export async function draftTestCase(input: DraftTestCaseInput): Promise<DraftedTestCase> {
  const locale = toDraftLocale(input.locale);
  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    return { ...emptyDraft(locale), source: "heuristic" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    const remote = await draftWithOpenAi(prompt, locale, apiKey);
    if (remote) return remote;
  }

  return { ...draftHeuristically(prompt, locale), source: "heuristic" };
}

async function draftWithOpenAi(
  prompt: string,
  locale: DraftLocale,
  apiKey: string,
): Promise<DraftedTestCase | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt(locale) },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) return null;

    const payload = openAiResponseSchema.safeParse(await response.json());
    if (!payload.success) return null;

    const content = payload.data.choices[0].message.content;
    if (!content) return null;

    const parsed = draftSchema.safeParse(JSON.parse(content) as unknown);
    if (!parsed.success) return null;

    const fallback = draftHeuristically(prompt, locale);
    return {
      title: parsed.data.title.trim() || fallback.title,
      summary: parsed.data.summary.trim() || fallback.summary,
      preconditions: parsed.data.preconditions.trim() || fallback.preconditions,
      steps: parsed.data.steps.trim() || fallback.steps,
      expectedResult: parsed.data.expectedResult.trim() || fallback.expectedResult,
      source: "openai",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function systemPrompt(locale: DraftLocale): string {
  const language = locale === "fa" ? "Persian (فارسی)" : "English";
  return [
    "You are a senior QA engineer writing test cases for a test management system.",
    `Answer in ${language}.`,
    "Return a JSON object with exactly these string keys: title, summary, preconditions, steps, expectedResult.",
    'The "steps" value must be newline separated and each line must start with its number followed by a period, e.g. "1. Open the login page".',
    'The "expectedResult" value must describe observable, verifiable outcomes.',
    "Keep the title under 120 characters and never invent product features that the prompt does not imply.",
  ].join(" ");
}

/* -------------------------------------------------------------------------- */
/* Deterministic fallback                                                      */
/* -------------------------------------------------------------------------- */

type Area = "auth" | "cart" | "search" | "form" | "api" | "navigation" | "generic";

interface Phrasebook {
  openArea: Record<Area, string>;
  preconditions: Record<Area, string[]>;
  successExpectation: Record<Area, string>;
  negativeExpectation: string;
  verifyStep: string;
  verifyPrefix: string;
  summary: (subject: string) => string;
  emptyPrompt: DraftShape;
  /** Clauses matching this are outcomes, not actions. */
  assertionMarker: RegExp;
  connectors: RegExp;
  subjectPrefix: RegExp;
  titlePrefix: RegExp;
  actionVerbs: RegExp;
}

type DraftShape = Omit<DraftedTestCase, "source">;

const AREA_KEYWORDS: Record<Exclude<Area, "generic">, RegExp> = {
  auth: /\b(login|log in|sign in|sign-in|signin|logout|sign out|password|credential|session|otp|2fa|token)\b|ورود|خروج|رمز|احراز|نشست/i,
  cart: /\b(cart|basket|checkout|order|payment|coupon|discount|shipping|invoice)\b|سبد|خرید|پرداخت|سفارش|تخفیف|ارسال کالا|فاکتور/i,
  search: /\b(search|filter|sort|query|autocomplete|facet)\b|جستجو|جست‌وجو|فیلتر|مرتب/i,
  form: /\b(form|submit|register|signup|sign up|profile|settings|upload|save|create|edit|update|delete)\b|فرم|ثبت|ارسال فرم|پروفایل|تنظیمات|بارگذاری|ذخیره|ویرایش|حذف/i,
  api: /\b(api|endpoint|request|response|payload|status code|rest|graphql|webhook)\b|درخواست|پاسخ|سرویس|وب‌سرویس/i,
  navigation: /\b(navigate|navigation|menu|page|redirect|link|breadcrumb|tab)\b|صفحه|منو|هدایت|لینک|زبانه/i,
};

const NEGATIVE_MARKER =
  /\b(invalid|incorrect|wrong|empty|blank|missing|expired|unauthorized|forbidden|reject|rejected|denied|fail|fails|failure|error|duplicate|negative)\b|نامعتبر|اشتباه|خالی|منقضی|غیرمجاز|رد\s|خطا|ناموفق|تکراری/i;

const EN: Phrasebook = {
  openArea: {
    auth: "Open the sign-in page as an anonymous visitor",
    cart: "Open the storefront and sign in as a shopper with an empty cart",
    search: "Open the page that exposes the search box",
    form: "Open the page that contains the form under test",
    api: "Prepare an API client with a valid base URL and authentication header",
    navigation: "Open the application entry point",
    generic: "Open the application area described by the scenario",
  },
  preconditions: {
    auth: ["A registered and active user account exists", "No active session in the browser"],
    cart: ["At least one purchasable product is available", "The shopper's cart starts empty"],
    search: ["Indexed content that matches and does not match the query exists"],
    form: ["The user has permission to open and submit the form"],
    api: ["A valid API key or bearer token is available", "The service is reachable"],
    navigation: ["The application is deployed and reachable"],
    generic: ["The application is reachable with seeded demo data"],
  },
  successExpectation: {
    auth: "The user is authenticated, redirected to the dashboard, and a session cookie is set.",
    cart: "The cart reflects the change immediately and totals recalculate correctly.",
    search: "Only matching results are listed, ordered by relevance, with the result count shown.",
    form: "The submission is persisted, a success confirmation is shown, and the data survives a reload.",
    api: "The response returns 2xx with a body matching the documented schema.",
    navigation: "The target view renders without errors and the URL reflects the destination.",
    generic: "The system reaches the described state without errors in the UI or console.",
  },
  negativeExpectation:
    "The action is rejected with a clear, field-level error message, no data is persisted, and the user stays on the same screen.",
  verifyStep: "Observe the resulting screen, messages, and persisted data",
  verifyPrefix: "Verify that ",
  summary: (subject) => `Validates that ${subject}.`,
  emptyPrompt: {
    title: "Untitled test case",
    summary: "Describe the behaviour to validate.",
    preconditions: "The application is reachable with seeded demo data",
    steps: "1. Open the application area under test\n2. Perform the action under test\n3. Observe the resulting state",
    expectedResult: "The system behaves as specified without errors.",
  },
  assertionMarker: /\b(should|must|expect|expected|is shown|appears|displays|displayed|results? in|redirects?)\b/i,
  connectors:
    /(?:\r?\n)+|;|\s+(?:and then|then|after that|afterwards|next|finally)\s+|,\s+(?=(?:and\s+)?(?:then|the\s|user\s|it\s))/i,
  subjectPrefix:
    /^(?:as (?:an?|the) [a-z ]{2,20}(?:,|\s)|(?:the |a |an )?(?:user|shopper|customer|admin|tester|visitor|system|i)\s+(?:should (?:be able to|not be able to)|must(?: be able to)?|can(?:not)?|is able to|tries to|attempts to|wants to)?\s*)/i,
  titlePrefix: /^(?:test(?: that| case for)?|verify(?: that)?|check(?: that)?|ensure(?: that)?|validate(?: that)?)\s+/i,
  actionVerbs:
    /^(?:open|navigate|go|visit|click|tap|press|enter|type|fill|submit|select|choose|upload|download|search|filter|sort|add|remove|delete|clear|update|edit|change|set|apply|send|call|post|get|put|patch|request|login|log|sign|logout|register|create|confirm|cancel|refresh|reload|reset|wait|scroll|drag|drop|switch|toggle|observe|verify|check|repeat)\b/i,
};

const FA: Phrasebook = {
  openArea: {
    auth: "صفحه ورود را به عنوان کاربر مهمان باز کنید",
    cart: "فروشگاه را باز کنید و با کاربری که سبد خرید خالی دارد وارد شوید",
    search: "صفحه‌ای را که کادر جستجو دارد باز کنید",
    form: "صفحه‌ای را که فرم مورد آزمون در آن است باز کنید",
    api: "یک کلاینت API با آدرس پایه و هدر احراز هویت معتبر آماده کنید",
    navigation: "صفحه اصلی برنامه را باز کنید",
    generic: "بخشی از برنامه که در سناریو توصیف شده را باز کنید",
  },
  preconditions: {
    auth: ["یک حساب کاربری ثبت‌شده و فعال وجود دارد", "هیچ نشست فعالی در مرورگر باز نیست"],
    cart: ["حداقل یک کالای قابل خرید موجود است", "سبد خرید کاربر در ابتدا خالی است"],
    search: ["محتوای ایندکس‌شده‌ای که با عبارت جستجو مطابق و نامطابق باشد وجود دارد"],
    form: ["کاربر دسترسی باز کردن و ارسال فرم را دارد"],
    api: ["کلید API یا توکن معتبر در اختیار است", "سرویس در دسترس است"],
    navigation: ["برنامه استقرار یافته و در دسترس است"],
    generic: ["برنامه با داده‌های نمونه در دسترس است"],
  },
  successExpectation: {
    auth: "کاربر احراز هویت می‌شود، به داشبورد هدایت می‌شود و کوکی نشست تنظیم می‌گردد.",
    cart: "سبد خرید بلافاصله تغییر را نشان می‌دهد و مبالغ به‌درستی بازمحاسبه می‌شوند.",
    search: "فقط نتایج مرتبط به ترتیب بیشترین تطابق و همراه با تعداد نتایج نمایش داده می‌شوند.",
    form: "داده ذخیره می‌شود، پیام موفقیت نمایش داده می‌شود و پس از بازخوانی صفحه باقی می‌ماند.",
    api: "پاسخ با کد ۲xx و بدنه‌ای مطابق قرارداد مستندشده بازگردانده می‌شود.",
    navigation: "نمای مقصد بدون خطا رندر می‌شود و نشانی صفحه با مقصد هم‌خوان است.",
    generic: "سیستم بدون خطا در رابط کاربری یا کنسول به وضعیت توصیف‌شده می‌رسد.",
  },
  negativeExpectation:
    "عملیات با پیام خطای روشن و مرتبط با همان فیلد رد می‌شود، داده‌ای ذخیره نمی‌گردد و کاربر در همان صفحه می‌ماند.",
  verifyStep: "صفحه نتیجه، پیام‌ها و داده ذخیره‌شده را بررسی کنید",
  verifyPrefix: "بررسی کنید که ",
  summary: (subject) => `اعتبارسنجی این‌که ${subject}.`,
  emptyPrompt: {
    title: "مورد آزمون بدون عنوان",
    summary: "رفتاری که باید اعتبارسنجی شود را توصیف کنید.",
    preconditions: "برنامه با داده‌های نمونه در دسترس است",
    steps: "1. بخش مورد آزمون را باز کنید\n2. عملیات مورد آزمون را انجام دهید\n3. وضعیت نتیجه را بررسی کنید",
    expectedResult: "سیستم مطابق مشخصات و بدون خطا رفتار می‌کند.",
  },
  assertionMarker: /باید|انتظار|نمایش داده|نشان داده|هدایت می‌شود|منجر/,
  connectors: /(?:\r?\n)+|؛|;|\s*(?:و\s+)?(?:سپس|بعد از آن|در ادامه|در پایان|آنگاه)\s*|،\s+(?=(?:سپس|کاربر|سیستم))/,
  subjectPrefix: /^(?:به عنوان [^،]{2,20}،\s*)?(?:کاربر|مشتری|خریدار|مدیر|آزمونگر|سیستم)?\s*(?:باید بتواند|نباید بتواند|می‌تواند|نمی‌تواند|باید|تلاش می‌کند تا)?\s*/,
  titlePrefix: /^(?:آزمون(?:\s+این‌که)?|بررسی(?:\s+این‌که)?|اطمینان از(?:\s+این‌که)?|اعتبارسنجی(?:\s+این‌که)?)\s+/,
  actionVerbs:
    /^(?:باز|وارد|کلیک|انتخاب|ثبت|ارسال|جستجو|جست‌وجو|اضافه|افزودن|حذف|پاک|ویرایش|تغییر|تنظیم|اعمال|فراخوانی|بازخوانی|بازنشانی|صبر|اسکرول|بررسی|تایید|تأیید|مشاهده|درخواست|پرداخت|خروج|تکرار)/,
};

const PHRASEBOOKS: Record<DraftLocale, Phrasebook> = { en: EN, fa: FA };

function emptyDraft(locale: DraftLocale): DraftShape {
  return PHRASEBOOKS[locale].emptyPrompt;
}

/** Exported for reuse in tests and for callers that want the fallback without a network hop. */
export function draftHeuristically(prompt: string, locale: DraftLocale): DraftShape {
  const book = PHRASEBOOKS[locale];
  const normalized = prompt.replace(/[ \t]+/g, " ").trim();
  if (normalized.length === 0) return emptyDraft(locale);

  const area = detectArea(normalized);
  const isNegative = NEGATIVE_MARKER.test(normalized);

  const explicit = extractExplicitSteps(normalized);
  const clauses =
    explicit.length > 0 ? explicit : splitClauses(normalized, book.connectors);

  const actions: string[] = [];
  const outcomes: string[] = [];
  for (const clause of clauses) {
    const target = explicit.length === 0 && book.assertionMarker.test(clause) ? outcomes : actions;
    target.push(clause);
  }
  // A prompt made only of assertions still needs something to execute.
  if (actions.length === 0 && outcomes.length > 0) {
    actions.push(outcomes[0]);
  }

  const steps = buildSteps({ book, area, actions, useOpening: explicit.length === 0 });
  const subject = stripSubject(normalized, book).replace(/[.!?؟。]+$/u, "");

  return {
    title: buildTitle(normalized, book),
    summary: book.summary(lowerFirst(subject)),
    preconditions: book.preconditions[area].join("\n"),
    steps,
    expectedResult: buildExpectedResult({ book, area, isNegative, outcomes }),
  };
}

function detectArea(prompt: string): Area {
  for (const [area, pattern] of Object.entries(AREA_KEYWORDS)) {
    if (pattern.test(prompt)) return area as Area;
  }
  return "generic";
}

function extractExplicitSteps(prompt: string): string[] {
  const listItem = /^\s*(?:\d+[.)]|[-*•])\s+(.*\S)\s*$/;
  const items = prompt
    .split(/\r?\n/)
    .map((line) => listItem.exec(line)?.[1])
    .filter((value): value is string => value !== undefined);
  return items.length >= 2 ? items : [];
}

function splitClauses(prompt: string, connectors: RegExp): string[] {
  const splitter = new RegExp(connectors.source, `${connectors.flags.replace("g", "")}g`);
  return prompt
    .split(splitter)
    .map((clause) => clause.trim().replace(/^[,،;؛]\s*/, ""))
    .filter((clause) => clause.length > 2);
}

function buildSteps(args: {
  book: Phrasebook;
  area: Area;
  actions: string[];
  useOpening: boolean;
}): string {
  const { book, area, actions, useOpening } = args;
  const lines: string[] = [];
  if (useOpening) lines.push(book.openArea[area]);
  for (const action of actions) {
    const imperative = toImperative(action, book);
    if (imperative.length > 0 && !lines.includes(imperative)) lines.push(imperative);
  }
  lines.push(book.verifyStep);

  return lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

function toImperative(clause: string, book: Phrasebook): string {
  const stripped = stripSubject(clause, book).replace(/[.!?؟]+$/u, "");
  if (stripped.length === 0) return "";
  if (book.actionVerbs.test(stripped)) return upperFirst(stripped);
  return `${book.verifyPrefix}${lowerFirst(stripped)}`;
}

function stripSubject(clause: string, book: Phrasebook): string {
  return clause.replace(book.subjectPrefix, "").trim();
}

function buildTitle(prompt: string, book: Phrasebook): string {
  const firstSentence = prompt.split(/(?<=[.!?؟])\s+|\r?\n/)[0] ?? prompt;
  const cleaned = firstSentence
    .replace(book.titlePrefix, "")
    .replace(/[.!?؟]+$/u, "")
    .trim();
  const title = upperFirst(cleaned.length > 0 ? cleaned : prompt);
  return title.length > 120 ? `${title.slice(0, 117).trimEnd()}…` : title;
}

function buildExpectedResult(args: {
  book: Phrasebook;
  area: Area;
  isNegative: boolean;
  outcomes: string[];
}): string {
  const { book, area, isNegative, outcomes } = args;
  const stated = outcomes
    .map((outcome) => upperFirst(stripSubject(outcome, book).replace(/[.!?؟]+$/u, "")))
    .filter((outcome) => outcome.length > 0)
    .map((outcome) => `${outcome}.`);

  const baseline = isNegative ? book.negativeExpectation : book.successExpectation[area];
  return stated.length > 0 ? [...stated, baseline].join("\n") : baseline;
}

function upperFirst(value: string): string {
  return value.length === 0 ? value : value[0].toLocaleUpperCase() + value.slice(1);
}

function lowerFirst(value: string): string {
  return value.length === 0 ? value : value[0].toLocaleLowerCase() + value.slice(1);
}
