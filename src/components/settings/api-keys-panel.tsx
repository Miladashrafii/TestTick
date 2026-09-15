"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Copy, KeyRound, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateApiKeyState } from "@/lib/actions/api-keys";

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
  ownerName: string;
};

const initialState: CreateApiKeyState = {};

export function ApiKeysPanel({
  projectId,
  keys,
  createAction,
  revokeAction,
}: {
  projectId: string;
  keys: ApiKeyRow[];
  createAction: (
    state: CreateApiKeyState,
    formData: FormData,
  ) => Promise<CreateApiKeyState>;
  revokeAction: (formData: FormData) => void;
}) {
  const t = useTranslations("apiKeys");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [state, formAction, pending] = useActionState(createAction, initialState);
  const [copied, setCopied] = React.useState(false);

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the key stays on screen for manual selection.
    }
  }

  return (
    <Card id="api-keys">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-teal-700" aria-hidden />
          {t("title")}
        </CardTitle>
        <p className="font-secondary text-sm text-slate-500">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {state.plaintext && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
              <ShieldAlert className="size-4" aria-hidden />
              {t("shownOnce")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-amber-200 bg-white/70 px-2 py-1.5 font-mono text-xs text-slate-900">
                {state.plaintext}
              </code>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void copy(state.plaintext!)}
              >
                <Copy aria-hidden />
                {copied ? t("copied") : t("copy")}
              </Button>
            </div>
          </div>
        )}

        {keys.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {key.name}
                    </span>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                      {key.keyPrefix}…
                    </code>
                    {key.revoked ? (
                      <Badge variant="danger">{t("revoked")}</Badge>
                    ) : (
                      <Badge variant="success">{t("active")}</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 font-secondary text-xs text-slate-500">
                    {t("meta", {
                      owner: key.ownerName,
                      created: format.dateTime(new Date(key.createdAt), {
                        dateStyle: "medium",
                      }),
                      lastUsed: key.lastUsedAt
                        ? format.dateTime(new Date(key.lastUsedAt), {
                            dateStyle: "medium",
                          })
                        : tCommon("none"),
                    })}
                  </p>
                </div>
                {!key.revoked && (
                  <form action={revokeAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="keyId" value={key.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {t("revoke")}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          action={formAction}
          className="flex flex-wrap items-end gap-3 border-t border-slate-200/70 pt-4"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor="api-key-name">{t("nameField")}</Label>
            <Input
              id="api-key-name"
              name="name"
              required
              placeholder={t("namePlaceholder")}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? tCommon("loading") : t("create")}
          </Button>
        </form>

        {state.error && (
          <p role="alert" className="text-sm text-rose-700">
            {t(`error.${state.error}`)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
