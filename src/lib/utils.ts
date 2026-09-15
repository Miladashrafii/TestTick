import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function caseExternalId(prefix: string, id: number) {
  return `${prefix}-${String(id).padStart(4, "0")}`;
}

export function statusColor(status: string) {
  switch (status) {
    case "PASSED":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "FAILED":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "BLOCKED":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "SKIPPED":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-sky-50 text-sky-800 border-sky-200";
  }
}

export function importanceColor(importance: string) {
  switch (importance) {
    case "HIGH":
      return "text-rose-700 bg-rose-50";
    case "LOW":
      return "text-slate-600 bg-slate-50";
    default:
      return "text-teal-700 bg-teal-50";
  }
}
