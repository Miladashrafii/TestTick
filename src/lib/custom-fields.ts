import { prisma } from "@/lib/prisma";

export type CustomFieldType = "string" | "text" | "number" | "date" | "list" | "checkbox";
export type CustomFieldScope = "testcase" | "user" | "plan";

export interface CustomFieldDefinition {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  /** Choices for list fields, parsed from the comma separated `options` column. */
  options: string[];
  appliesTo: string;
  required: boolean;
}

export interface CustomFieldWithValue extends CustomFieldDefinition {
  valueId: string | null;
  value: string;
}

export function parseFieldOptions(options: string): string[] {
  return options
    .split(",")
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
}

function toDefinition(field: {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  options: string;
  appliesTo: string;
  required: boolean;
}): CustomFieldDefinition {
  return {
    id: field.id,
    name: field.name,
    label: field.label,
    fieldType: field.fieldType,
    options: parseFieldOptions(field.options),
    appliesTo: field.appliesTo,
    required: field.required,
  };
}

export async function listCustomFields(
  projectId: string,
  appliesTo?: string,
): Promise<CustomFieldDefinition[]> {
  const fields = await prisma.customField.findMany({
    where: { projectId, ...(appliesTo ? { appliesTo } : {}) },
    orderBy: { name: "asc" },
  });
  return fields.map(toDefinition);
}

/** Every case-scoped field for the project, each carrying the value stored for `caseId`. */
export async function listCaseFieldValues(
  projectId: string,
  caseId: string,
): Promise<CustomFieldWithValue[]> {
  const fields = await prisma.customField.findMany({
    where: { projectId, appliesTo: "testcase" },
    orderBy: { name: "asc" },
    include: { values: { where: { caseId }, select: { id: true, value: true } } },
  });

  return fields.map((field) => {
    const stored = field.values[0];
    return {
      ...toDefinition(field),
      valueId: stored?.id ?? null,
      value: stored?.value ?? "",
    };
  });
}
