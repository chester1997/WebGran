"use client";

import { useRef, useCallback, ReactNode, ElementType } from "react";
import Link from "next/link";
import { motion, useAnimation, type Variants } from "motion/react";

export interface IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface SidebarNavItemProps {
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
  accent?: "blue" | "emerald";
}

const MOTION_VARIANTS: Variants = {
  normal: {
    y: 0,
    rotate: 0,
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  animate: {
    y: [0, -1.5, 0],
    transition: {
      duration: 0.3,
      ease: "easeInOut",
    },
  },
};

export default function SidebarNavItem({
  href,
  onClick,
  label,
  isActive = false,
  icon: StaticIcon,
  animatedIcon: AnimatedIcon,
  iconSize = 19,
  iconClassName,
  className,
  children,
  accent = "blue",
}: SidebarNavItemProps) {
  const iconRef = useRef<IconHandle | null>(null);
  const motionControls = useAnimation();

  const handleMouseEnter = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    iconRef.current?.startAnimation?.();
    motionControls.start("animate");
  }, [motionControls]);

  const handleMouseLeave = useCallback(() => {
    iconRef.current?.stopAnimation?.();
    motionControls.start("normal");
  }, [motionControls]);

  const handleFocus = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    iconRef.current?.startAnimation?.();
    motionControls.start("animate");
  }, [motionControls]);

  const handleBlur = useCallback(() => {
    iconRef.current?.stopAnimation?.();
    motionControls.start("normal");
  }, [motionControls]);

  const activeBgClass = accent === "emerald"
    ? "bg-emerald-500/10 text-white font-medium"
    : "bg-[#3984FF]/10 text-white font-medium";

  const defaultClasses = `flex items-center gap-3.5 px-3 h-[42px] min-h-[42px] rounded-[10px] text-[15px] font-medium transition-all duration-150 relative ${
    isActive
      ? activeBgClass
      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
  }`;

  const defaultIconColor = isActive
    ? accent === "emerald"
      ? "text-emerald-400"
      : "text-[#3984FF]"
    : "text-zinc-400";

  const renderIcon = () => {
    if (AnimatedIcon) {
      return (
        <div
          className={
            iconClassName ||
            `w-[19px] h-[19px] shrink-0 flex items-center justify-center transition-colors ${defaultIconColor}`
          }
        >
          <AnimatedIcon ref={iconRef} size={iconSize} />
        </div>
      );
    }
    if (StaticIcon) {
      const staticEl = (
        <StaticIcon
          size={iconSize}
          className={
            iconClassName ||
            `w-[19px] h-[19px] shrink-0 transition-colors ${defaultIconColor}`
          }
        />
      );

      return (
        <motion.span
          animate={motionControls}
          initial="normal"
          variants={MOTION_VARIANTS}
          className="w-[19px] h-[19px] shrink-0 flex items-center justify-center pointer-events-none"
          style={{ originX: 0.5, originY: 0.5 }}
        >
          {staticEl}
        </motion.span>
      );
    }
    return null;
  };

  const content = (
    <>
      {renderIcon()}
      <span className="truncate flex-1 whitespace-nowrap">{label}</span>
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
      className={`w-full text-left cursor-pointer ${className || defaultClasses}`}
    >
      {content}
    </button>
  );
}

