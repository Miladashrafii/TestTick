"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, Table2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DatasetRow } from "@/lib/datasets";

export type CaseDatasetSummary = {
  id: string;
  name: string;
  rows: DatasetRow[];
};

const inputClass =
  "h-9 w-full min-w-[8rem] rounded-md border border-slate-200/90 bg-white/90 px-2 text-sm text-slate-900";

/** Accepts a JSON array of objects or a CSV block with a header row. */
function parsePaste(text: string): DatasetRow[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) return null;
      return parsed.map((row) =>
        Object.fromEntries(
          Object.entries(row as Record<string, unknown>).map(([key, value]) => [
            key,
            value === null || value === undefined ? "" : String(value),
          ]),
        ),
      );
    } catch {
      return null;
    }
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return null;
  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(
      headers.map((header, index) => [header, (cells[index] ?? "").trim()]),
    );
  });
}

function DatasetEditor({
  projectId,
  caseId,
  dataset,
  saveAction,
  deleteAction,
}: {
  projectId: string;
  caseId: string;
  dataset: CaseDatasetSummary | null;
  saveAction: (formData: FormData) => void;
  deleteAction?: (formData: FormData) => void;
}) {
  const t = useTranslations("datasets");
  const tCommon = useTranslations("common");

  const [name, setName] = React.useState(dataset?.name ?? "");
  const [rows, setRows] = React.useState<DatasetRow[]>(dataset?.rows ?? []);
  const [paste, setPaste] = React.useState("");
  const [pasteError, setPasteError] = React.useState(false);
  const [newColumn, setNewColumn] = React.useState("");

  // The first row defines the dataset shape.
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  function setCell(rowIndex: number, column: string, value: string) {
    setRows((previous) =>
      previous.map((row, index) =>
        index === rowIndex ? { ...row, [column]: value } : row,
      ),
    );
  }

  function addRow() {
    const template = Object.fromEntries(columns.map((column) => [column, ""]));
    setRows((previous) => [...previous, template]);
  }

  function addColumn() {
    const column = newColumn.trim();
    if (!column) return;
    setRows((previous) =>
      previous.length === 0
        ? [{ [column]: "" }]
        : previous.map((row) => ({ ...row, [column]: row[column] ?? "" })),
    );
    setNewColumn("");
  }

  function removeColumn(column: string) {
    setRows((previous) =>
      previous.map((row) => {
        const next = { ...row };
        delete next[column];
        return next;
      }),
    );
  }

  function applyPaste() {
    const parsed = parsePaste(paste);
    if (!parsed || parsed.length === 0) {
      setPasteError(true);
      return;
    }
    setPasteError(false);
    setRows(parsed);
    setPaste("");
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200/70 bg-slate-50/50 p-4">
      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="caseId" value={caseId} />
        {dataset && <input type="hidden" name="datasetId" value={dataset.id} />}
        <input type="hidden" name="rowsJson" value={JSON.stringify(rows)} />

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label htmlFor={`dataset-name-${dataset?.id ?? "new"}`}>
              {t("nameField")}
            </Label>
            <Input
              id={`dataset-name-${dataset?.id ?? "new"}`}
              name="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>
          <Badge variant="secondary">{t("rowCount", { count: rows.length })}</Badge>
        </div>

        {columns.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white/60">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                {t("tableCaption", { name: name || t("untitled") })}
              </caption>
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80">
                  <th scope="col" className="w-10 px-2 py-2 text-start text-xs text-slate-500">
                    #
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="px-2 py-2 text-start text-xs font-semibold text-slate-600"
                    >
                      <span className="inline-flex items-center gap-1">
                        {column}
                        <button
                          type="button"
                          onClick={() => removeColumn(column)}
                          aria-label={t("removeColumn", { column })}
                          className="rounded p-0.5 text-slate-400 hover:text-rose-700"
                        >
                          <Trash2 className="size-3" aria-hidden />
                        </button>
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="w-10 px-2 py-2">
                    <span className="sr-only">{tCommon("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-1.5 text-xs tabular-nums text-slate-400">
                      {rowIndex + 1}
                    </td>
                    {columns.map((column) => (
                      <td key={column} className="px-2 py-1.5">
                        <input
                          className={inputClass}
                          value={row[column] ?? ""}
                          aria-label={`${column} ${rowIndex + 1}`}
                          onChange={(event) =>
                            setCell(rowIndex, column, event.target.value)
                          }
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setRows((previous) =>
                            previous.filter((_, index) => index !== rowIndex),
                          )
                        }
                        aria-label={t("removeRow", { index: rowIndex + 1 })}
                        className="rounded p-1 text-slate-400 hover:text-rose-700"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            <Plus aria-hidden />
            {t("addRow")}
          </Button>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor={`dataset-column-${dataset?.id ?? "new"}`}>
                {t("addColumn")}
              </Label>
              <Input
                id={`dataset-column-${dataset?.id ?? "new"}`}
                value={newColumn}
                onChange={(event) => setNewColumn(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addColumn();
                  }
                }}
                placeholder="username"
                className="h-9 w-40"
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={addColumn}>
              {tCommon("create")}
            </Button>
          </div>
          <Button type="submit" size="sm" className="ms-auto">
            {tCommon("save")}
          </Button>
        </div>
      </form>

      <div className="space-y-1.5 border-t border-slate-200/70 pt-3">
        <Label htmlFor={`dataset-paste-${dataset?.id ?? "new"}`}>
          {t("bulkPaste")}
        </Label>
        <Textarea
          id={`dataset-paste-${dataset?.id ?? "new"}`}
          rows={3}
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          placeholder={t("bulkPastePlaceholder")}
          className="min-h-[64px] font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={applyPaste}>
            {t("replaceRows")}
          </Button>
          {pasteError && (
            <p role="alert" className="text-xs text-rose-700">
              {t("pasteError")}
            </p>
          )}
        </div>
      </div>

      {dataset && deleteAction && (
        <form action={deleteAction} className="border-t border-slate-200/70 pt-3">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="datasetId" value={dataset.id} />
          <Button type="submit" variant="ghost" size="sm">
            <Trash2 aria-hidden />
            {t("deleteDataset")}
          </Button>
        </form>
      )}
    </div>
  );
}

export function CaseDatasets({
  projectId,
  caseId,
  datasets,
  saveAction,
  deleteAction,
}: {
  projectId: string;
  caseId: string;
  datasets: CaseDatasetSummary[];
  saveAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}) {
  const t = useTranslations("datasets");
  const [creating, setCreating] = React.useState(datasets.length === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Table2 className="size-4 text-teal-700" aria-hidden />
          {t("title")}
        </CardTitle>
        <p className="font-secondary text-sm text-slate-500">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {datasets.map((dataset) => (
          <DatasetEditor
            key={dataset.id}
            projectId={projectId}
            caseId={caseId}
            dataset={dataset}
            saveAction={saveAction}
            deleteAction={deleteAction}
          />
        ))}

        {creating ? (
          <DatasetEditor
            projectId={projectId}
            caseId={caseId}
            dataset={null}
            saveAction={saveAction}
          />
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCreating(true)}
          >
            <Plus aria-hidden />
            {t("newDataset")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
