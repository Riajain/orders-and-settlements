"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/domain/status";

const LABEL: Record<OrderStatus | "all", string> = {
  all: "All",
  pending: "Pending",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
};

export function StatusFilterBar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const current = search.get("status");

  const items: (OrderStatus | "all")[] = ["all", ...ORDER_STATUSES];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => {
        const active = s === "all" ? !current : current === s;
        const params = new URLSearchParams(search);
        if (s === "all") params.delete("status");
        else params.set("status", s);
        const href = `${pathname}${params.toString() ? "?" + params.toString() : ""}`;
        return (
          <Link
            key={s}
            href={href}
            className={cn(
              "rounded-full px-3 py-1 text-sm ring-1 transition-colors",
              active
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-100",
            )}
          >
            {LABEL[s]}
          </Link>
        );
      })}
    </div>
  );
}
