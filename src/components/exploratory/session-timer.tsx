"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

/** `mm:ss`, growing to `h:mm:ss` once a session runs past the hour. */
function format(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "-" : "";
  const seconds = Math.abs(totalSeconds);
  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = pad(seconds % 60);
  if (hours > 0) return `${sign}${hours}:${pad(minutes)}:${rest}`;
  return `${sign}${pad(minutes)}:${rest}`;
}

/** Counts down the time box for an active charter; goes negative when over. */
export function SessionTimer({
  startedAtIso,
  durationMin,
}: {
  startedAtIso: string;
  durationMin: number;
}) {
  const t = useTranslations("exploratory");
  const startedAt = React.useMemo(
    () => new Date(startedAtIso).getTime(),
    [startedAtIso],
  );
  const totalSeconds = durationMin * 60;

  const [elapsed, setElapsed] = React.useState(() =>
    Math.floor((Date.now() - startedAt) / 1000),
  );

  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const remaining = totalSeconds - elapsed;
  const overtime = remaining < 0;
  const progress = Math.min(100, Math.max(0, (elapsed / totalSeconds) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Timer className="size-3.5" aria-hidden />
          {overtime ? t("overtime") : t("remaining")}
        </span>
        <span
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums",
            overtime ? "text-rose-700" : "text-teal-700",
          )}
          aria-live="off"
        >
          {format(remaining)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("timeboxProgress")}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-1000 ease-linear",
            overtime ? "bg-rose-500" : "bg-teal-600",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="font-secondary text-xs text-slate-500">
        {t("elapsedOf", { elapsed: format(elapsed), total: durationMin })}
      </p>
    </div>
  );
}
