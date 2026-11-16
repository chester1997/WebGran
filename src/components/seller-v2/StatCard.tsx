"use client";

import React, { ReactNode } from "react";
import { Card } from "./Card";

export type StatAccent = "blue" | "green" | "purple" | "amber" | "red" | "zinc";

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  accent?: StatAccent;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  subtext,
  icon,
  accent = "blue",
  trend,
  className = "",
  onClick,
}: StatCardProps) {
  const accentStyles: Record<StatAccent, { iconContainer: string; textHighlight: string }> = {
    blue: {
      iconContainer: "bg-[#3b82f6]/10 text-[#60a5fa] border-[#3b82f6]/20",
      textHighlight: "text-[#60a5fa]",
    },
    green: {
      iconContainer: "bg-[#22c55e]/10 text-[#4ade80] border-[#22c55e]/20",
      textHighlight: "text-[#4ade80]",
    },
    purple: {
      iconContainer: "bg-[#a855f7]/10 text-[#c084fc] border-[#a855f7]/20",
      textHighlight: "text-[#c084fc]",
    },
    amber: {
      iconContainer: "bg-[#f59e0b]/10 text-[#fbbf24] border-[#f59e0b]/20",
      textHighlight: "text-[#fbbf24]",
    },
    red: {
      iconContainer: "bg-[#ef4444]/10 text-[#f87171] border-[#ef4444]/20",
      textHighlight: "text-[#f87171]",
    },
    zinc: {
      iconContainer: "bg-white/[0.05] text-[#a1a1aa] border-white/10",
      textHighlight: "text-[#a1a1aa]",
    },
  };

  const currentAccent = accentStyles[accent];

  return (
    <Card
      padding="md"
      interactive={Boolean(onClick)}
      onClick={onClick}
      className={`flex flex-col justify-between gap-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[#a1a1aa] truncate">
          {label}
        </span>
        {icon && (
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${currentAccent.iconContainer}`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f4f4f5] tabular-nums">
            {value}
          </span>
          {trend && (
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                trend.isPositive
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>

        {subtext && (
          <p className="text-xs text-[#71717a] truncate">
            {subtext}
          </p>
        )}
      </div>
    </Card>
  );
}

