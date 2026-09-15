import { getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  submitCustomField,
  submitCustomFieldDelete,
} from "@/lib/actions/forms";
import type { CustomFieldDefinition } from "@/lib/custom-fields";

const FIELD_TYPES = [
  "string",
  "text",
  "number",
  "date",
  "list",
  "checkbox",
] as const;

const FIELD_SCOPES = ["testcase", "plan", "user"] as const;

const selectClass =
  "flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm text-slate-900";

export async function CustomFieldsManager({
  locale,
  projectId,
  fields,
}: {
  locale: string;
  projectId: string;
  fields: CustomFieldDefinition[];
}) {
  const t = await getTranslations("customFields");
  const tCommon = await getTranslations("common");
  const save = submitCustomField.bind(null, locale);
  const remove = submitCustomFieldDelete.bind(null, locale);

  return (
    <Card id="custom-fields">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="font-secondary text-sm text-slate-500">{t("subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.length === 0 ? (
          <p className="text-sm text-slate-500">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {fields.map((field) => (
              <li
                key={field.id}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {field.label}
                    </span>
                    <Badge variant="secondary">{field.name}</Badge>
                    <Badge variant="outline">{t(`type.${field.fieldType}`)}</Badge>
                    <Badge variant="outline">
                      {t(`appliesTo.${field.appliesTo}`)}
                    </Badge>
                    {field.required && (
                      <Badge variant="warning">{t("required")}</Badge>
                    )}
                  </div>
                  {field.options.length > 0 && (
                    <p className="mt-1 font-secondary text-xs text-slate-500">
                      {t("options")}: {field.options.join(" · ")}
                    </p>
                  )}
                </div>
                <form action={remove}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="fieldId" value={field.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`${tCommon("delete")} ${field.label}`}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={save}
          className="grid gap-4 border-t border-slate-200/70 pt-5 sm:grid-cols-2"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <div className="space-y-1.5">
            <Label htmlFor="cf-label">{t("labelField")}</Label>
            <Input id="cf-label" name="label" required placeholder={t("labelHint")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-name">{t("nameField")}</Label>
            <Input
              id="cf-name"
              name="name"
              required
              pattern="[a-z0-9_]+"
              placeholder="browser_version"
              aria-describedby="cf-name-hint"
            />
            <p id="cf-name-hint" className="text-xs text-slate-500">
              {t("nameHint")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-type">{t("typeField")}</Label>
            <select
              id="cf-type"
              name="fieldType"
              defaultValue="string"
              className={selectClass}
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`type.${type}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-applies">{t("appliesToField")}</Label>
            <select
              id="cf-applies"
              name="appliesTo"
              defaultValue="testcase"
              className={selectClass}
            >
              {FIELD_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {t(`appliesTo.${scope}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cf-options">{t("options")}</Label>
            <Input
              id="cf-options"
              name="options"
              placeholder={t("optionsHint")}
              aria-describedby="cf-options-hint"
            />
            <p id="cf-options-hint" className="text-xs text-slate-500">
              {t("optionsOnlyList")}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              name="required"
              className="size-4 rounded accent-teal-700"
            />
            {t("markRequired")}
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm">
              {t("addField")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
