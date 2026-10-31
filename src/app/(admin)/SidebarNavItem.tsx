"use client";

import { useRef, useCallback, ReactNode, ElementType } from "react";
import Link from "next/link";

export interface IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface SidebarNavItemProps {
  href?: string;
  onClick?: () => void;
  label: string;
  isActive?: boolean;
  icon?: ElementType;
  animatedIcon?: ElementType;
  iconSize?: number;
  iconClassName?: string;
  className?: string;
  children?: ReactNode;
}

export default function SidebarNavItem({
  href,
  onClick,
  label,
  isActive = false,
  icon: StaticIcon,
  animatedIcon: AnimatedIcon,
  iconSize = 16,
  iconClassName,
  className,
  children,
}: SidebarNavItemProps) {
  const iconRef = useRef<IconHandle | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    iconRef.current?.startAnimation?.();
  }, []);

  const handleMouseLeave = useCallback(() => {
    iconRef.current?.stopAnimation?.();
  }, []);

  const handleFocus = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    iconRef.current?.startAnimation?.();
  }, []);

  const handleBlur = useCallback(() => {
    iconRef.current?.stopAnimation?.();
  }, []);

  const defaultClasses = `flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-lg text-xs font-medium transition-all duration-150 relative ${
    isActive
      ? "bg-blue-500/10 text-white font-semibold"
      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
  }`;

  const defaultIconColor = isActive ? "text-blue-500" : "text-zinc-400";

  const renderIcon = () => {
    if (AnimatedIcon) {
      return (
        <div
          className={
            iconClassName ||
            `w-4 h-4 shrink-0 flex items-center justify-center transition-colors ${defaultIconColor}`
          }
        >
          <AnimatedIcon ref={iconRef} size={iconSize} />
        </div>
      );
    }
    if (StaticIcon) {
      return (
        <StaticIcon
          className={
            iconClassName ||
            `w-4 h-4 shrink-0 transition-colors ${defaultIconColor}`
          }
          strokeWidth={1.8}
        />
      );
    }
    return null;
  };

  const content = (
    <>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {renderIcon()}
        <span className="truncate">{label}</span>
      </div>
      {children}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={className || defaultClasses}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className || defaultClasses}
    >
      {content}
    </button>
  );
}

