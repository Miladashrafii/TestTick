"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ExecutionStatus } from "@prisma/client";
import { Check, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, statusColor } from "@/lib/utils";

export type ExecutionBoardCase = {
  planCaseId: string;
  caseId: string;
  caseRef: string;
  title: string;
  assigneeName: string | null;
  latestStatus: ExecutionStatus | null;
  latestNotes: string;
};

const STATUS_KEYS: Record<string, ExecutionStatus> = {
  p: ExecutionStatus.PASSED,
  f: ExecutionStatus.FAILED,
  b: ExecutionStatus.BLOCKED,
  s: ExecutionStatus.SKIPPED,
};

const STATUS_ORDER = [
  ExecutionStatus.PASSED,
  ExecutionStatus.FAILED,
  ExecutionStatus.BLOCKED,
  ExecutionStatus.SKIPPED,
] as const;

const STATUS_LABEL_KEY: Record<(typeof STATUS_ORDER)[number], string> = {
  PASSED: "pass",
  FAILED: "fail",
  BLOCKED: "block",
  SKIPPED: "skip",
};

type RowState = { status: ExecutionStatus; notes: string; savedAt: number | null };

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function ExecutionBoard({
  projectId,
  buildId,
  platformId,
  cases,
  saveAction,
}: {
  projectId: string;
  buildId: string;
  platformId?: string;
  cases: ExecutionBoardCase[];
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("execution");
  const tShortcuts = useTranslations("shortcuts");

  const [selected, setSelected] = React.useState(0);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const [rows, setRows] = React.useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      cases.map((item) => [
        item.planCaseId,
        {
          status: item.latestStatus ?? ExecutionStatus.PASSED,
          notes: "",
          savedAt: null,
        },
      ]),
    ),
  );

  const rowRefs = React.useRef<(HTMLLIElement | null)[]>([]);
  const notesRefs = React.useRef<Record<string, HTMLTextAreaElement | null>>({});

  const selectedCase = cases[selected];

  const patchRow = React.useCallback(
    (planCaseId: string, patch: Partial<RowState>) => {
      setRows((previous) => ({
        ...previous,
        [planCaseId]: { ...previous[planCaseId], ...patch },
      }));
    },
    [],
  );

  const save = React.useCallback(
    async (planCaseId: string) => {
      const row = rows[planCaseId];
      if (!row) return;

      setPendingId(planCaseId);
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("planCaseId", planCaseId);
      formData.set("buildId", buildId);
      if (platformId) formData.set("platformId", platformId);
      formData.set("status", row.status);
      formData.set("notes", row.notes);

      try {
        await saveAction(formData);
        patchRow(planCaseId, { notes: "", savedAt: Date.now() });
        setAnnouncement(t("savedAnnouncement", { status: row.status }));
      } finally {
        setPendingId(null);
      }
    },
    [rows, projectId, buildId, platformId, saveAction, patchRow, t],
  );

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const typing = isTypingTarget(event.target);
      const current = cases[selected];
      if (!current) return;

      if (event.key === "Escape" && typing) {
        (event.target as HTMLElement).blur();
        return;
      }

      // Enter saves from anywhere, including the notes field.
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void save(current.planCaseId);
        return;
      }

      if (typing) return;

      const key = event.key.toLowerCase();

      if (key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((index) => Math.min(index + 1, cases.length - 1));
        return;
      }
      if (key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((index) => Math.max(index - 1, 0));
        return;
      }
      if (key === "n") {
        event.preventDefault();
        notesRefs.current[current.planCaseId]?.focus();
        return;
      }
      if (key in STATUS_KEYS) {
        event.preventDefault();
        const status = STATUS_KEYS[key];
        patchRow(current.planCaseId, { status });
        setAnnouncement(`${current.caseRef}: ${status}`);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cases, selected, save, patchRow]);

  React.useEffect(() => {
    rowRefs.current[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <div className="space-y-4">
      <ShortcutCheatsheet />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ul className="space-y-3">
        {cases.map((item, index) => {
          const row = rows[item.planCaseId];
          const active = index === selected;
          const saving = pendingId === item.planCaseId;

          return (
            <li
              key={item.planCaseId}
              ref={(element) => {
                rowRefs.current[index] = element;
              }}
            >
              <Card
                aria-current={active ? "true" : undefined}
                onMouseDown={() => setSelected(index)}
                className={cn(
                  "transition-shadow",
                  active && "ring-2 ring-teal-600/40 shadow-md",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base font-medium">
                      <span className="font-mono text-xs text-slate-500">
                        {item.caseRef}
                      </span>{" "}
                      {item.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {row.savedAt && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <Check className="size-3.5" aria-hidden />
                          {t("saved")}
                        </span>
                      )}
                      {item.latestStatus && (
                        <Badge
                          variant="outline"
                          className={cn("border", statusColor(item.latestStatus))}
                        >
                          {item.latestStatus.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {item.assigneeName && (
                    <p className="text-xs text-slate-500">
                      {t("assignee")}: {item.assigneeName}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-slate-700">
                      {t("status")}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_ORDER.map((status) => {
                        const checked = row.status === status;
                        const shortcut = Object.keys(STATUS_KEYS).find(
                          (key) => STATUS_KEYS[key] === status,
                        );
                        return (
                          <label
                            key={status}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                              checked
                                ? "border-teal-600 bg-teal-50 text-teal-800"
                                : "border-slate-200 text-slate-700 hover:bg-slate-100",
                            )}
                          >
                            <input
                              type="radio"
                              name={`status-${item.planCaseId}`}
                              value={status}
                              checked={checked}
                              onChange={() =>
                                patchRow(item.planCaseId, { status })
                              }
                              className="accent-teal-700"
                            />
                            {t(STATUS_LABEL_KEY[status])}
                            <kbd className="kbd">{shortcut}</kbd>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="space-y-1.5">
                    <Label htmlFor={`notes-${item.planCaseId}`}>{t("notes")}</Label>
                    <Textarea
                      id={`notes-${item.planCaseId}`}
                      ref={(element) => {
                        notesRefs.current[item.planCaseId] = element;
                      }}
                      rows={2}
                      value={row.notes}
                      onFocus={() => setSelected(index)}
                      onChange={(event) =>
                        patchRow(item.planCaseId, { notes: event.target.value })
                      }
                      placeholder={t("notesPlaceholder")}
                      className="min-h-[60px]"
                    />
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void save(item.planCaseId)}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Save aria-hidden />
                    )}
                    {t("saveResult")}
                    <kbd className="kbd">{tShortcuts("enterKey")}</kbd>
                  </Button>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {selectedCase && (
        <p className="font-secondary text-xs text-slate-500">
          {t("selectedHint", {
            current: selected + 1,
            total: cases.length,
            ref: selectedCase.caseRef,
          })}
        </p>
      )}
    </div>
  );
}

function ShortcutCheatsheet() {
  const t = useTranslations("shortcuts");

  const items = [
    { keys: ["j", "k"], label: t("navigate") },
    { keys: ["p"], label: t("pass") },
    { keys: ["f"], label: t("fail") },
    { keys: ["b"], label: t("block") },
    { keys: ["s"], label: t("skip") },
    { keys: ["n"], label: t("notes") },
    { keys: [t("enterKey")], label: t("save") },
    { keys: [t("escKey")], label: t("blur") },
  ];

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("title")}
        </span>
        {items.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            {item.keys.map((key) => (
              <kbd key={key} className="kbd">
                {key}
              </kbd>
            ))}
            <span className="text-xs text-slate-600">{item.label}</span>
          </span>
        ))}
      </CardContent>
    </Card>
  );
}
