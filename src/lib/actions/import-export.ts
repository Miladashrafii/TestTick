"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isProjectMember } from "@/lib/authz";
import {
  detectTransferFormat,
  exportCases,
  importCases,
  isTransferFormat,
  type ImportResult,
  type TransferFormat,
} from "@/lib/import-export";

/** Fields are optional so the UI can seed `useActionState` with an empty object. */
export interface ImportCasesState {
  ok?: boolean;
  format?: TransferFormat;
  result?: ImportResult;
  error?: string;
}

export type ImportState = ImportCasesState;

export interface ExportPayload {
  filename: string;
  contentType: string;
  /** Text formats are returned as-is; xlsx is base64 so it survives the action boundary. */
  content: string;
  encoding: "utf8" | "base64";
}

async function readUpload(
  formData: FormData,
): Promise<{ content: string | Uint8Array; filename?: string; contentType?: string } | null> {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    return {
      content: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      contentType: file.type,
    };
  }

  const pasted = formData.get("content");
  if (typeof pasted === "string" && pasted.trim().length > 0) {
    return { content: pasted };
  }
  return null;
}

export async function importCasesAction(
  locale: string,
  formData: FormData,
): Promise<ImportCasesState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthorized" };

  const projectId = String(formData.get("projectId") ?? "");
  if (projectId.length === 0) return { ok: false, error: "invalidInput" };

  const allowed =
    session.user.role === "ADMINISTRATOR" ||
    (await isProjectMember(session.user.id, projectId));
  if (!allowed) return { ok: false, error: "forbidden" };

  const upload = await readUpload(formData);
  if (!upload) return { ok: false, error: "noContent" };

  const requested = formData.get("format");
  const requestedFormat = typeof requested === "string" ? requested : null;
  const format = isTransferFormat(requestedFormat)
    ? requestedFormat
    : detectTransferFormat(upload.filename, upload.contentType ?? null);
  if (!format) return { ok: false, error: "unknownFormat" };

  const result = await importCases({
    projectId,
    format,
    content: upload.content,
    options: { authorId: session.user.id },
  });

  revalidatePath(`/${locale}/projects/${projectId}/suites`);
  revalidatePath(`/${locale}/projects/${projectId}`);

  return { ok: result.created + result.updated > 0, format, result };
}

export async function exportCasesAction(
  projectId: string,
  format: TransferFormat,
): Promise<ExportPayload | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const allowed =
    session.user.role === "ADMINISTRATOR" ||
    (await isProjectMember(session.user.id, projectId));
  if (!allowed) return null;

  const file = await exportCases(projectId, format);
  if (typeof file.body === "string") {
    return {
      filename: file.filename,
      contentType: file.contentType,
      content: file.body,
      encoding: "utf8",
    };
  }

  return {
    filename: file.filename,
    contentType: file.contentType,
    content: Buffer.from(file.body).toString("base64"),
    encoding: "base64",
  };
}
