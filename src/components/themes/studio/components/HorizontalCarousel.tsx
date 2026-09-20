"use client";

import React, { ReactNode, useRef, useState, useCallback } from "react";
import { CarouselIconRenderer } from "@/lib/carousel-icons";

interface HorizontalCarouselProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  indicatorType?: "BAR" | "ICON" | "NONE";
  iconName?: string | null;
  iconColor?: string | null;
  children: ReactNode;
  className?: string;
}

export function HorizontalCarousel({
  title,
  subtitle,
  indicatorType = "BAR",
  iconName,
  iconColor,
  children,
  className = "",
}: HorizontalCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);

  // Mouse Drag Handlers for Telegram Desktop & PC browsers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsMouseDown(true);
    setHasMoved(false);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !containerRef.current) return;
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed factor
    if (Math.abs(x - startX) > 6) {
      setHasMoved(true);
    }
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    setIsMouseDown(false);
  };

  // Prevent link click if user was dragging mouse
  const handleClickCapture = useCallback(
    (e: React.MouseEvent) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [hasMoved]
  );

  // Wheel Handler: Convert vertical scroll (deltaY) to horizontal scroll in Desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (!containerRef.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      containerRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <section className={`py-2 w-full overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-[var(--miniapp-content-padding-x)] mb-3">
          {typeof title === "string" ? (
            <div className="flex items-center gap-2">
              {indicatorType === "ICON" && (
                <CarouselIconRenderer 
                  iconName={iconName || "Flame"} 
                  color={iconColor || "#8B5CF6"} 
                  className="w-5 h-5 shrink-0"
                  size={20}
                />
              )}
              {indicatorType === "BAR" && (
                <div className="w-1 h-4 bg-violet-600 rounded-full shrink-0" />
              )}
              {/* indicatorType === 'NONE': render nothing */}

              <h2 className="text-white text-base font-bold tracking-tight uppercase flex items-center gap-2">
                {title}
                {subtitle && (
                  <span className="text-zinc-600 text-[10px] lowercase font-normal">
                    {subtitle}
                  </span>
                )}
              </h2>
            </div>
          ) : (
            title
          )}
        </div>
      )}

      {/* Carousel Track Container with Drag-to-Scroll & Mouse Wheel Support */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onClickCapture={handleClickCapture}
        onWheel={handleWheel}
        className={`flex overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 w-full select-none ${
          isMouseDown ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          scrollPaddingLeft: "var(--miniapp-content-padding-x)",
          scrollPaddingRight: "var(--miniapp-content-padding-x)",
          gap: "var(--carousel-gap)",
          scrollBehavior: isMouseDown ? "auto" : "smooth",
        }}
      >
        {/* Leading Grid Track Spacer: Forces Item 1 & Rank Number 1 to start at var(--miniapp-content-padding-x) in all WebView engines */}
        <div
          className="shrink-0 pointer-events-none"
          style={{ width: "calc(var(--miniapp-content-padding-x) - var(--carousel-gap))" }}
          aria-hidden="true"
        />

        {children}

        {/* Trailing Grid Track Spacer */}
        <div
          className="shrink-0 pointer-events-none"
          style={{ width: "calc(var(--miniapp-content-padding-x) - var(--carousel-gap))" }}
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
