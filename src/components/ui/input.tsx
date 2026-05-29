import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-11 w-full rounded-md border border-violet-200 bg-white px-4 text-sm text-violet-950 outline-none transition placeholder:text-violet-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-100", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-28 w-full rounded-md border border-violet-200 bg-white px-4 py-3 text-sm text-violet-950 outline-none transition placeholder:text-violet-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-100", className)} {...props} />;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-medium text-violet-950">{children}</label>;
}
