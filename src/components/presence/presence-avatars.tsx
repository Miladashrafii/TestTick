"use client";

import { useTranslations } from "next-intl";
import { usePresence } from "@/components/presence/presence-provider";
import { cn } from "@/lib/utils";

const AVATAR_TINTS = [
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-sky-100 text-sky-800 border-sky-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Stable tint per user so an avatar keeps its colour between renders. */
function tintFor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) % 9973;
  }
  return AVATAR_TINTS[hash % AVATAR_TINTS.length];
}

export function PresenceAvatars({
  max = 4,
  className,
}: {
  max?: number;
  className?: string;
}) {
  const t = useTranslations("presence");
  const { peers } = usePresence();

  if (peers.length === 0) return null;

  const shown = peers.slice(0, max);
  const overflow = peers.length - shown.length;

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      aria-label={t("online", { count: peers.length })}
    >
      <span className="sr-only">{t("online", { count: peers.length })}</span>
      <div className="flex -space-x-1.5 rtl:space-x-reverse">
        {shown.map((peer) => (
          <span
            key={peer.userId}
            title={peer.label ? `${peer.userName} · ${peer.label}` : peer.userName}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-full border text-[10px] font-semibold shadow-sm",
              tintFor(peer.userId),
            )}
          >
            {initials(peer.userName)}
          </span>
        ))}
        {overflow > 0 && (
          <span className="inline-flex size-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-600 shadow-sm">
            +{overflow}
          </span>
        )}
      </div>
      <span
        className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse"
        aria-hidden
      />
    </div>
  );
}
