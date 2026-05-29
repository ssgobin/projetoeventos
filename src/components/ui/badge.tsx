import { cn } from "../../lib/utils";

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "red" | "amber" | "blue" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm",
        tone === "slate" && "bg-violet-100 text-violet-800",
        tone === "green" && "bg-violet-50 text-violet-800 ring-1 ring-violet-200",
        tone === "red" && "bg-fuchsia-50 text-fuchsia-800",
        tone === "amber" && "bg-purple-100 text-purple-800",
        tone === "blue" && "bg-indigo-100 text-indigo-800"
      )}
    >
      {children}
    </span>
  );
}
