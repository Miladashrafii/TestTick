import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/routing";
import { submitCaseFieldValues } from "@/lib/actions/forms";
import type { CustomFieldWithValue } from "@/lib/custom-fields";

const selectClass =
  "flex h-10 w-full rounded-lg border border-slate-200/90 bg-white/90 px-3 text-sm text-slate-900";

function inputTypeFor(fieldType: string): string {
  if (fieldType === "number") return "number";
  if (fieldType === "date") return "date";
  return "text";
}

export async function CustomFieldValues({
  locale,
  projectId,
  caseId,
  fields,
}: {
  locale: string;
  projectId: string;
  caseId: string;
  fields: CustomFieldWithValue[];
}) {
  const t = await getTranslations("customFields");
  const tCommon = await getTranslations("common");
  const save = submitCaseFieldValues.bind(null, locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("caseTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <p className="text-sm text-slate-500">
            {t("emptyForCase")}{" "}
            <Link
              href={`/projects/${projectId}/settings#custom-fields`}
              className="text-teal-700 hover:underline"
            >
              {t("defineInSettings")}
            </Link>
          </p>
        ) : (
          <form action={save} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="caseId" value={caseId} />
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => {
                const inputId = `field_${field.id}`;
                return (
                  <div
                    key={field.id}
                    className={field.fieldType === "text" ? "sm:col-span-2" : undefined}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor={inputId}>
                        {field.label}
                        {field.required && (
                          <span className="ms-1 text-rose-700" aria-hidden>
                            *
                          </span>
                        )}
                      </Label>

                      {field.fieldType === "list" ? (
                        <select
                          id={inputId}
                          name={inputId}
                          defaultValue={field.value}
                          required={field.required}
                          className={selectClass}
                        >
                          <option value="">—</option>
                          {field.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.fieldType === "checkbox" ? (
                        <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
                          <input
                            id={inputId}
                            type="checkbox"
                            name={inputId}
                            defaultChecked={field.value === "true"}
                            className="size-4 rounded accent-teal-700"
                          />
                          {t("enabled")}
                        </label>
                      ) : field.fieldType === "text" ? (
                        <Textarea
                          id={inputId}
                          name={inputId}
                          rows={3}
                          defaultValue={field.value}
                          required={field.required}
                          className="min-h-[80px]"
                        />
                      ) : (
                        <Input
                          id={inputId}
                          name={inputId}
                          type={inputTypeFor(field.fieldType)}
                          defaultValue={field.value}
                          required={field.required}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button type="submit" size="sm">
              {tCommon("save")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
