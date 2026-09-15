import { prisma } from "@/lib/prisma";

export type SavedViewEntity = "cases" | "plans" | "executions" | "requirements";

export interface SavedViewSummary {
  id: string;
  name: string;
  entity: string;
  filters: Record<string, string>;
  shared: boolean;
  ownerId: string;
  ownerName: string;
  createdAt: Date;
}

export function parseViewFilters(filtersJson: string): Record<string, string> {
  let payload: unknown;
  try {
    payload = JSON.parse(filtersJson);
  } catch {
    return {};
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return {};

  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") filters[key] = value;
    else if (typeof value === "number" || typeof value === "boolean") filters[key] = String(value);
  }
  return filters;
}

/** Returns the caller's own views plus every view shared with the project. */
export async function listSavedViews(
  projectId: string,
  userId: string,
  entity?: string,
): Promise<SavedViewSummary[]> {
  const views = await prisma.savedView.findMany({
    where: {
      projectId,
      ...(entity ? { entity } : {}),
      OR: [{ shared: true }, { ownerId: userId }],
    },
    orderBy: [{ entity: "asc" }, { name: "asc" }],
    include: { owner: { select: { name: true } } },
  });

  return views.map((view) => ({
    id: view.id,
    name: view.name,
    entity: view.entity,
    filters: parseViewFilters(view.filtersJson),
    shared: view.shared,
    ownerId: view.ownerId,
    ownerName: view.owner.name,
    createdAt: view.createdAt,
  }));
}

export function viewFiltersToSearchParams(filters: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value.length > 0) params.set(key, value);
  }
  return params.toString();
}
