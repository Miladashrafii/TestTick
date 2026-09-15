"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AtSign, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type MentionMember = { id: string; name: string; email: string };

/** The `@partial` fragment immediately before the caret, if any. */
function activeMentionQuery(value: string, caret: number) {
  const upToCaret = value.slice(0, caret);
  const at = upToCaret.lastIndexOf("@");
  if (at === -1) return null;
  const fragment = upToCaret.slice(at + 1);
  if (/[\s@]/.test(fragment)) return null;
  return { start: at, query: fragment.toLowerCase() };
}

export function CommentBox({
  projectId,
  caseId,
  planId,
  executionId,
  members,
  postAction,
}: {
  projectId: string;
  caseId?: string;
  planId?: string;
  executionId?: string;
  members: MentionMember[];
  postAction: (formData: FormData) => void;
}) {
  const t = useTranslations("activity");

  const [value, setValue] = React.useState("");
  const [mention, setMention] = React.useState<{ start: number; query: string } | null>(
    null,
  );
  const [highlighted, setHighlighted] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const suggestions = React.useMemo(() => {
    if (!mention) return [];
    return members
      .filter(
        (member) =>
          member.email.toLowerCase().includes(mention.query) ||
          member.name.toLowerCase().includes(mention.query),
      )
      .slice(0, 5);
  }, [members, mention]);

  const open = mention !== null && suggestions.length > 0;

  function syncMention(next: string, caret: number) {
    setMention(activeMentionQuery(next, caret));
    setHighlighted(0);
  }

  function insert(member: MentionMember) {
    if (!mention) return;
    const before = value.slice(0, mention.start);
    const after = value.slice(mention.start + 1 + mention.query.length);
    const next = `${before}@${member.email} ${after}`;
    setValue(next);
    setMention(null);

    const caret = before.length + member.email.length + 2;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlighted((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted(
          (index) => (index - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insert(suggestions[highlighted]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMention(null);
        return;
      }
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      ref={formRef}
      action={postAction}
      onSubmit={() => setValue("")}
      className="space-y-2"
    >
      <input type="hidden" name="projectId" value={projectId} />
      {caseId && <input type="hidden" name="caseId" value={caseId} />}
      {planId && <input type="hidden" name="planId" value={planId} />}
      {executionId && <input type="hidden" name="executionId" value={executionId} />}

      <div className="relative">
        <Textarea
          ref={textareaRef}
          name="body"
          required
          rows={3}
          value={value}
          placeholder={t("commentPlaceholder")}
          aria-describedby="comment-hint"
          aria-autocomplete="list"
          aria-expanded={open}
          className="min-h-[80px]"
          onChange={(event) => {
            setValue(event.target.value);
            syncMention(event.target.value, event.target.selectionStart ?? 0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setMention(null)}
        />

        {open && (
          <ul
            role="listbox"
            aria-label={t("mentionSuggestions")}
            className="absolute inset-x-0 bottom-full z-20 mb-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            {suggestions.map((member, index) => (
              <li key={member.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlighted}
                  // Keeps the textarea focused so the caret position survives.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insert(member)}
                  onMouseEnter={() => setHighlighted(index)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-start text-sm",
                    index === highlighted
                      ? "bg-teal-50 text-teal-900"
                      : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <AtSign className="size-3.5 shrink-0 opacity-60" aria-hidden />
                  <span className="font-medium">{member.name}</span>
                  <span className="truncate text-xs text-slate-500">
                    {member.email}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="comment-hint" className="text-xs text-slate-500">
          {t("mentionHint")}
        </p>
        <Button type="submit" size="sm" disabled={value.trim().length === 0}>
          <Send aria-hidden />
          {t("post")}
        </Button>
      </div>
    </form>
  );
}
