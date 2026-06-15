import { cn } from "../../lib/utils";

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "red" | "amber" | "blue" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm",
        tone === "slate" && "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
        tone === "green" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        tone === "red" && "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
        tone === "amber" && "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
        tone === "blue" && "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
      )}
    >
      {children}
    </span>
  );
}
