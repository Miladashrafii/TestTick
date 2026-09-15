export interface ApiErrorBody {
  error: string;
  details?: unknown;
}

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, { status: 200, ...init });
}

export function jsonCreated<T>(data: T): Response {
  return Response.json(data, { status: 201 });
}

export function jsonError(status: number, error: string, details?: unknown): Response {
  const body: ApiErrorBody = details === undefined ? { error } : { error, details };
  return Response.json(body, { status });
}

export function unauthorized(message = "Authentication required"): Response {
  return jsonError(401, message, undefined);
}

export function forbidden(message = "Not allowed for this project"): Response {
  return jsonError(403, message);
}

export function notFound(message = "Not found"): Response {
  return jsonError(404, message);
}

export function badRequest(error: string, details?: unknown): Response {
  return jsonError(400, error, details);
}

export function fileResponse(
  body: string | Uint8Array,
  contentType: string,
  filename: string,
): Response {
  const payload: BodyInit = typeof body === "string" ? body : new Uint8Array(body);
  return new Response(payload, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
