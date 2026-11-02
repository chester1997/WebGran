"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface DashboardEmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  className?: string;
}

export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  actionText,
  actionHref,
  className = "",
}: DashboardEmptyStateProps) {
  return (
    <div
      className={`w-full py-8 px-4 sm:p-8 flex flex-col items-center justify-center text-center bg-white/[0.015] border border-white/[0.04] rounded-xl ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#3984FF] flex items-center justify-center mb-3 shrink-0">
        <Icon className="w-5 h-5 stroke-[1.75]" />
      </div>
      <h4 className="text-xs sm:text-sm font-semibold text-zinc-200 tracking-tight mb-1">
        {title}
      </h4>
      <p className="text-[11px] sm:text-xs text-zinc-400 max-w-xs leading-relaxed mb-3">
        {description}
      </p>
      {actionText && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-200 hover:text-white transition-all focus:outline-none focus:ring-1 focus:ring-[#3984FF]"
        >
          <span>{actionText}</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#3984FF]" />
        </Link>
      )}
    </div>
  );
}

