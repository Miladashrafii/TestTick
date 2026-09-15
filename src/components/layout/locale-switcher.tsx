"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const locales = [
  { code: "en" as const, label: "EN" },
  { code: "fa" as const, label: "FA" },
];

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(next: "en" | "fa") {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-slate-200/80 bg-white/70 p-0.5 text-xs font-medium shadow-sm",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {locales.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => switchLocale(l.code)}
          className={cn(
            "rounded-md px-2.5 py-1 transition-colors",
            locale === l.code
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
