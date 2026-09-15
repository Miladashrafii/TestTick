export interface Pagination {
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function readPagination(params: URLSearchParams, defaultLimit = DEFAULT_LIMIT): Pagination {
  const limit = Number.parseInt(params.get("limit") ?? "", 10);
  const offset = Number.parseInt(params.get("offset") ?? "", 10);

  return {
    limit: Number.isInteger(limit) ? Math.min(Math.max(limit, 1), MAX_LIMIT) : defaultLimit,
    offset: Number.isInteger(offset) && offset > 0 ? offset : 0,
  };
}

export function readEnum<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = params.get(key);
  if (value === null) return undefined;
  const upper = value.toUpperCase() as T;
  return allowed.includes(upper) ? upper : undefined;
}

export function readInt(params: URLSearchParams, key: string): number | undefined {
  const parsed = Number.parseInt(params.get(key) ?? "", 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function readString(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  return value !== undefined && value.length > 0 ? value : undefined;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function listResponse<T>(items: T[], total: number, page: Pagination): ListResponse<T> {
  return { items, total, limit: page.limit, offset: page.offset };
}

/** Accepts a JSON body and returns null when the payload is absent or malformed. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
