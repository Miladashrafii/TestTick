import { prisma } from "@/lib/prisma";

/** A single parameter row of a data-driven case: column name → value. */
export type DatasetRow = Record<string, string>;

export interface DatasetSummary {
  id: string;
  name: string;
  columns: string[];
  rows: DatasetRow[];
  updatedAt: Date;
}

export function parseDatasetRows(rowsJson: string): DatasetRow[] {
  let payload: unknown;
  try {
    payload = JSON.parse(rowsJson);
  } catch {
    return [];
  }
  if (!Array.isArray(payload)) return [];

  const rows: DatasetRow[] = [];
  for (const entry of payload) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const row: DatasetRow = {};
    for (const [key, value] of Object.entries(entry)) {
      row[key] =
        typeof value === "string"
          ? value
          : typeof value === "number" || typeof value === "boolean"
            ? String(value)
            : "";
    }
    rows.push(row);
  }
  return rows;
}

export function datasetColumns(rows: DatasetRow[]): string[] {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) columns.add(key);
  }
  return [...columns];
}

export function serializeDatasetRows(rows: DatasetRow[]): string {
  return JSON.stringify(rows);
}

export async function listCaseDatasets(caseId: string): Promise<DatasetSummary[]> {
  const datasets = await prisma.caseDataset.findMany({
    where: { caseId },
    orderBy: { createdAt: "asc" },
  });

  return datasets.map((dataset) => {
    const rows = parseDatasetRows(dataset.rowsJson);
    return {
      id: dataset.id,
      name: dataset.name,
      columns: datasetColumns(rows),
      rows,
      updatedAt: dataset.updatedAt,
    };
  });
}
