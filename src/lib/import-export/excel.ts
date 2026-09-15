import * as XLSX from "xlsx";
import {
  CASE_COLUMNS,
  emptyImportResult,
  loadCaseRecords,
  normalizeColumn,
  toExecutionType,
  toExternalId,
  toImportance,
  toReviewStatus,
  writeCaseRecords,
  type CaseColumn,
  type CaseRecord,
  type ImportResult,
  type WriteOptions,
} from "@/lib/import-export/case-records";

const SHEET_NAME = "Test Cases";

type SheetRow = Record<string, string | number>;

export function caseRecordsToSheetRows(records: CaseRecord[]): SheetRow[] {
  return records.map((record) => {
    const row: SheetRow = {};
    for (const column of CASE_COLUMNS) {
      const value = record[column];
      row[column] = value === null ? "" : value;
    }
    return row;
  });
}

export async function exportCasesXlsx(projectId: string): Promise<Uint8Array> {
  const records = await loadCaseRecords(projectId);
  const sheet = XLSX.utils.json_to_sheet(caseRecordsToSheetRows(records), {
    header: [...CASE_COLUMNS],
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);

  const written: unknown = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Uint8Array(written as ArrayBuffer);
}

function cellToString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  return "";
}

export function sheetRowsToCaseRecords(rows: Array<Record<string, unknown>>): {
  records: CaseRecord[];
  errors: string[];
} {
  const records: CaseRecord[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const cells = new Map<CaseColumn, string>();
    for (const [header, value] of Object.entries(row)) {
      const column = normalizeColumn(header);
      if (column) cells.set(column, cellToString(value));
    }

    const title = cells.get("title") ?? "";
    if (title.length === 0) {
      errors.push(`Sheet row ${index + 2} has no title`);
      return;
    }

    records.push({
      externalId: toExternalId(cells.get("externalId")),
      suite: cells.get("suite") ?? "",
      title,
      summary: cells.get("summary") ?? "",
      preconditions: cells.get("preconditions") ?? "",
      steps: cells.get("steps") ?? "",
      expectedResult: cells.get("expectedResult") ?? "",
      importance: toImportance(cells.get("importance")),
      executionType: toExecutionType(cells.get("executionType")),
      reviewStatus: toReviewStatus(cells.get("reviewStatus")),
      automationKey: cells.get("automationKey") || null,
    });
  });

  return { records, errors };
}

export async function importCasesFromXlsx(
  projectId: string,
  data: Uint8Array,
  options: WriteOptions = {},
): Promise<ImportResult> {
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { ...emptyImportResult(), errors: ["Workbook has no sheets"] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const { records, errors } = sheetRowsToCaseRecords(rows);
  if (records.length === 0) {
    return { ...emptyImportResult(), errors: errors.length > 0 ? errors : ["Sheet has no rows"] };
  }

  const result = await writeCaseRecords(projectId, records, {
    fallbackSuiteName: "Excel Import",
    ...options,
  });
  return { ...result, errors: [...errors, ...result.errors] };
}
