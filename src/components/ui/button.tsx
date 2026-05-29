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
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium shadow-sm transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]",
        variant === "primary" && "bg-violet-950 text-white shadow-violet-950/10 hover:bg-violet-900 focus-visible:outline-violet-700",
        variant === "secondary" && "border border-violet-200 bg-white text-violet-950 hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-violet-700",
        variant === "ghost" && "shadow-none text-violet-900 hover:bg-violet-50 focus-visible:outline-violet-700",
        variant === "danger" && "bg-fuchsia-700 text-white shadow-fuchsia-700/10 hover:bg-fuchsia-800 focus-visible:outline-fuchsia-700",
        size === "sm" && "h-10 px-4 text-sm",
        size === "md" && "h-12 px-6 text-sm",
        size === "icon" && "h-10 w-10",
        className
      )}
      {...props}
    />
  );
}
