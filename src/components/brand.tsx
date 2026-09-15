import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export function Brand({
  className,
  showTagline = false,
}: {
  className?: string;
  showTagline?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex size-9 items-center justify-center rounded-lg bg-brand-solid text-on-brand shadow-sm">
        <CheckCircle2 className="size-5" strokeWidth={2.25} />
      </div>
      <div className="leading-tight">
        <span className="font-semibold tracking-tight text-slate-900">
          Test<span className="text-teal-700">Tick</span>
        </span>
        {showTagline && (
          <p className="text-xs text-slate-500">Modern test case management</p>
        )}
      </div>
    </div>
  );
}
