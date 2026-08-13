import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "gray" | "blue" | "green" | "red" | "amber";

const TONE_CLASSES: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
};

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

export function Badge({ className, tone = "gray", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
