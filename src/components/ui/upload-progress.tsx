import { Loader2 } from "lucide-react";

type UploadProgressProps = {
  label?: string;
  progress?: number;
};

export function UploadProgress({ label = "Enviando arquivo", progress = 0 }: UploadProgressProps) {
  const normalized = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="rounded-lg border border-violet-200 bg-white p-3 text-violet-950 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-xs font-medium">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-700" />
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 text-violet-950/60">{normalized}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
        <div className="h-full rounded-full bg-violet-700 transition-all duration-300" style={{ width: `${normalized}%` }} />
      </div>
    </div>
  );
}
