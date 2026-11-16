"use client";

import React, { ReactNode } from "react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-[#0e0e10] border border-[#26262a] rounded-2xl ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#16161a] border border-[#26262a] flex items-center justify-center text-[#9a9aa2] mb-4 shadow-inner">
        {icon}
      </div>

      <h3 className="text-base sm:text-lg font-semibold text-[#f4f4f5] tracking-tight mb-1.5">
        {title}
      </h3>

      <div className="text-xs sm:text-sm text-[#9a9aa2] max-w-sm mb-6 leading-relaxed">
        {description}
      </div>

      {action && (
        <Button
          variant="primary"
          size="md"
          leftIcon={action.icon}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

