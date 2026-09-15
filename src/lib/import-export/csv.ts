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

function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeField).join(",")).join("\r\n");
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, and embedded newlines. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;
  const text = input.replace(/^\uFEFF/, "");

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      endField();
      index += 1;
      continue;
    }
    if (char === "\r") {
      index += text[index + 1] === "\n" ? 2 : 1;
      endRow();
      continue;
    }
    if (char === "\n") {
      index += 1;
      endRow();
      continue;
    }

    field += char;
    index += 1;
  }

  if (field.length > 0 || row.length > 0) endRow();
  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}

export async function exportCasesCsv(projectId: string): Promise<string> {
  const records = await loadCaseRecords(projectId);
  const header: string[] = [...CASE_COLUMNS];
  const body = records.map((record) =>
    CASE_COLUMNS.map((column) => {
      const value = record[column];
      if (value === null) return "";
      return typeof value === "number" ? String(value) : value;
    }),
  );
  return toCsv([header, ...body]);
}

export function csvToCaseRecords(csv: string): { records: CaseRecord[]; errors: string[] } {
  const rows = parseCsv(csv);
  if (rows.length === 0) return { records: [], errors: ["CSV file is empty"] };

  const [headerRow, ...dataRows] = rows;
  const columns = headerRow.map(normalizeColumn);
  if (!columns.includes("title")) {
    return { records: [], errors: ['CSV header must contain a "title" column'] };
  }

  const errors: string[] = [];
  const records: CaseRecord[] = [];

  dataRows.forEach((row, rowIndex) => {
    const cells = new Map<CaseColumn, string>();
    columns.forEach((column, columnIndex) => {
      if (column) cells.set(column, (row[columnIndex] ?? "").trim());
    });

    const title = cells.get("title") ?? "";
    if (title.length === 0) {
      errors.push(`Row ${rowIndex + 2} has no title`);
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

export async function importCasesFromCsv(
  projectId: string,
  csv: string,
  options: WriteOptions = {},
): Promise<ImportResult> {
  const { records, errors } = csvToCaseRecords(csv);
  if (records.length === 0) {
    return { ...emptyImportResult(), errors };
  }

  const result = await writeCaseRecords(projectId, records, options);
  return { ...result, errors: [...errors, ...result.errors] };
}
