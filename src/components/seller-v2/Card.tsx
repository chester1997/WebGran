"use client";

import React, { forwardRef } from "react";

export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      padding = "md",
      interactive = false,
      className = "",
      ...props
    },
    ref
  ) => {
    const paddingStyles: Record<CardPadding, string> = {
      none: "p-0",
      sm: "p-3 sm:p-4",
      md: "p-4 sm:p-5 md:p-6",
      lg: "p-6 sm:p-8",
    };

    const interactiveStyles = interactive
      ? "hover:border-[#3a3a40] transition-colors duration-150 cursor-pointer"
      : "";

    return (
      <div
        ref={ref}
        className={`bg-[#0e0e10] border border-[#26262a] rounded-2xl shadow-sm relative overflow-hidden ${paddingStyles[padding]} ${interactiveStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

