"use client";

import { useRef, useCallback, ReactNode, ElementType } from "react";
import Link from "next/link";
import { motion, useAnimation, type Variants } from "motion/react";

export interface IconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export type FallbackAnimationType = "package" | "film" | "sliders";

interface SidebarNavItemProps {
  href?: string;
  onClick?: () => void;
  label: string;
  isActive?: boolean;
  icon?: ElementType;
  animatedIcon?: ElementType;
  fallbackAnimation?: FallbackAnimationType;
  iconSize?: number;
  iconClassName?: string;
  className?: string;
  children?: ReactNode;
}

const FALLBACK_VARIANTS: Record<FallbackAnimationType, Variants> = {
  package: {
    normal: {
      y: 0,
      transition: { duration: 0.25, ease: "easeOut" },
    },
    animate: {
      y: [0, -2, 0],
      transition: {
        duration: 0.3,
        type: "spring",
        stiffness: 400,
        damping: 15,
      },
    },
  },
  film: {
    normal: {
      rotate: 0,
      transition: { duration: 0.25, ease: "easeOut" },
    },
    animate: {
      rotate: [0, -8, 8, 0],
      transition: {
        duration: 0.3,
        ease: "easeInOut",
      },
    },
  },
  sliders: {
    normal: {
      y: 0,
      transition: { duration: 0.25, ease: "easeOut" },
    },
    animate: {
      y: [0, -1.5, 0],
      transition: {
        duration: 0.3,
        ease: "easeInOut",
      },
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
  fallbackAnimation,
  iconSize = 16,
  iconClassName,
  className,
  children,
}: SidebarNavItemProps) {
  const iconRef = useRef<IconHandle | null>(null);
  const fallbackControls = useAnimation();

  // Resolve fallback type (explicit prop or auto-inferred by label)
  const resolvedFallback: FallbackAnimationType | null =
    fallbackAnimation ||
    (label === "Planos WebGran"
      ? "package"
      : label === "Recursos & Features"
      ? "sliders"
      : label === "Biblioteca de Vídeos" || label === "Visão Geral"
      ? "film"
      : null);

  const handleMouseEnter = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    iconRef.current?.startAnimation?.();
    if (resolvedFallback) {
      fallbackControls.start("animate");
    }
  }, [resolvedFallback, fallbackControls]);

  const handleMouseLeave = useCallback(() => {
    iconRef.current?.stopAnimation?.();
    if (resolvedFallback) {
      fallbackControls.start("normal");
    }
  }, [resolvedFallback, fallbackControls]);

  const handleFocus = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    iconRef.current?.startAnimation?.();
    if (resolvedFallback) {
      fallbackControls.start("animate");
    }
  }, [resolvedFallback, fallbackControls]);

  const handleBlur = useCallback(() => {
    iconRef.current?.stopAnimation?.();
    if (resolvedFallback) {
      fallbackControls.start("normal");
    }
  }, [resolvedFallback, fallbackControls]);

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
      const staticEl = (
        <StaticIcon
          className={
            iconClassName ||
            `w-4 h-4 shrink-0 transition-colors ${defaultIconColor}`
          }
          strokeWidth={1.8}
        />
      );

      if (resolvedFallback && FALLBACK_VARIANTS[resolvedFallback]) {
        return (
          <motion.span
            animate={fallbackControls}
            initial="normal"
            variants={FALLBACK_VARIANTS[resolvedFallback]}
            className="w-4 h-4 shrink-0 flex items-center justify-center pointer-events-none"
            style={{ originX: 0.5, originY: 0.5 }}
          >
            {staticEl}
          </motion.span>
        );
      }

      return staticEl;
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
