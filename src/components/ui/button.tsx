import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
  asChild?: boolean;
};

export function Button({ className, variant = "primary", size = "md", asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold shadow-sm transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99]",
        variant === "primary" && "bg-indigo-600 text-white shadow-indigo-600/15 hover:bg-indigo-700 focus-visible:outline-indigo-600",
        variant === "secondary" && "border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-indigo-600",
        variant === "ghost" && "shadow-none text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-indigo-600",
        variant === "danger" && "bg-rose-600 text-white shadow-rose-600/10 hover:bg-rose-700 focus-visible:outline-rose-600",
        size === "sm" && "h-10 px-4 text-sm",
        size === "md" && "h-12 px-6 text-sm",
        size === "icon" && "h-10 w-10",
        className
      )}
      {...props}
    />
  );
}
