import { prisma } from "@/lib/prisma";
import { emptyImportResult, type ImportResult, type WriteOptions } from "@/lib/import-export/case-records";
import { exportCasesCsv, importCasesFromCsv } from "@/lib/import-export/csv";
import { exportCasesJson, importCasesFromJson } from "@/lib/import-export/json";
import { exportTestLinkXml, importTestLinkXml } from "@/lib/import-export/testlink";
import { exportCasesXlsx, importCasesFromXlsx } from "@/lib/import-export/excel";

export * from "@/lib/import-export/case-records";
export { exportCasesCsv, importCasesFromCsv, parseCsv, toCsv } from "@/lib/import-export/csv";
export { exportCasesJson, importCasesFromJson } from "@/lib/import-export/json";
export { exportTestLinkXml, importTestLinkXml } from "@/lib/import-export/testlink";
export { exportCasesXlsx, importCasesFromXlsx } from "@/lib/import-export/excel";

export const TRANSFER_FORMATS = ["csv", "json", "xlsx", "testlink"] as const;
export type TransferFormat = (typeof TRANSFER_FORMATS)[number];

export interface ExportedFile {
  filename: string;
  contentType: string;
  body: string | Uint8Array;
}

const CONTENT_TYPES: Record<TransferFormat, string> = {
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  testlink: "application/xml; charset=utf-8",
};

const EXTENSIONS: Record<TransferFormat, string> = {
  csv: "csv",
  json: "json",
  xlsx: "xlsx",
  testlink: "xml",
};

export function isTransferFormat(
  value: string | null | undefined,
): value is TransferFormat {
  return (
    value !== null && value !== undefined && (TRANSFER_FORMATS as readonly string[]).includes(value)
  );
}

export function detectTransferFormat(
  filename: string | undefined,
  contentType: string | null,
): TransferFormat | null {
  const name = (filename ?? "").toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";
  if (name.endsWith(".xml")) return "testlink";

  const type = (contentType ?? "").toLowerCase();
  if (type.includes("csv")) return "csv";
  if (type.includes("json")) return "json";
  if (type.includes("spreadsheet") || type.includes("excel")) return "xlsx";
  if (type.includes("xml")) return "testlink";
  return null;
}

export async function exportCases(
  projectId: string,
  format: TransferFormat,
): Promise<ExportedFile> {
  const project = await prisma.testProject.findUnique({
    where: { id: projectId },
    select: { prefix: true },
  });
  const slug = (project?.prefix ?? "cases").toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${slug}-cases-${stamp}.${EXTENSIONS[format]}`;

  const body =
    format === "csv"
      ? await exportCasesCsv(projectId)
      : format === "json"
        ? await exportCasesJson(projectId)
        : format === "testlink"
          ? await exportTestLinkXml(projectId)
          : await exportCasesXlsx(projectId);

  return { filename, contentType: CONTENT_TYPES[format], body };
}

export interface ImportRequest {
  projectId: string;
  format: TransferFormat;
  content: string | Uint8Array;
  options?: WriteOptions;
}

export async function importCases(request: ImportRequest): Promise<ImportResult> {
  const { projectId, format, content, options = {} } = request;

  if (format === "xlsx") {
    if (typeof content === "string") {
      return { ...emptyImportResult(), errors: ["Excel import requires binary file content"] };
    }
    return importCasesFromXlsx(projectId, content, options);
  }

  const text = typeof content === "string" ? content : new TextDecoder().decode(content);
  if (format === "csv") return importCasesFromCsv(projectId, text, options);
  if (format === "json") return importCasesFromJson(projectId, text, options);
  return importTestLinkXml(projectId, text, options);
}
