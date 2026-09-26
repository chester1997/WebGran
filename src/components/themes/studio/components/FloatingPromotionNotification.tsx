"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface NotificationItem {
  id: string;
  text: string;
  icon: string;
  countMin?: number | null;
  countMax?: number | null;
  productId?: string | null;
  productTitle?: string | null;
}

interface NotificationConfig {
  enabled: boolean;
  pages: string[];
  displayDuration: number;
  intervalMin: number;
  intervalMax: number;
  notifications: NotificationItem[];
}

interface ActiveToast {
  text: string;
  icon: string;
  productTitle?: string | null;
}

export function FloatingPromotionNotification({ storeSlug }: { storeSlug: string }) {
  const pathname = usePathname();
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [activeToast, setActiveToast] = useState<ActiveToast | null>(null);
  const [visible, setVisible] = useState(false);

  const displayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch store notification settings once
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/telegram/floating-notifications?storeSlug=${encodeURIComponent(storeSlug)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && data.enabled && data.notifications?.length > 0) {
          setConfig(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [storeSlug]);

  // Handle display logic & page routing
  useEffect(() => {
    // Clear any existing timers
    if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
    if (intervalTimeoutRef.current) clearTimeout(intervalTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    setVisible(false);
    setActiveToast(null);

    if (!config || !config.enabled || !config.notifications || config.notifications.length === 0) {
      return;
    }

    // Determine current page type
    const isHome = pathname === `/miniapp/${storeSlug}` || pathname === `/miniapp/${storeSlug}/`;
    const isProduct = pathname.includes(`/miniapp/${storeSlug}/product/`);
    const isCategory = pathname.includes(`/miniapp/${storeSlug}/category/`);
    const isSearch = pathname.includes(`/miniapp/${storeSlug}/search`);

    const pageAllowed =
      (isHome && config.pages.includes("home")) ||
      (isProduct && config.pages.includes("product")) ||
      (isCategory && config.pages.includes("category")) ||
      (isSearch && config.pages.includes("search"));

    if (!pageAllowed) {
      return;
    }

    let activeIndex = 0;

    const scheduleNext = () => {
      if (!config.notifications.length) return;

      // Pick next notification item (rotate or random)
      const item = config.notifications[activeIndex % config.notifications.length];
      activeIndex++;

      // Generate random count between min and max
      const countMin = item.countMin || 5;
      const countMax = item.countMax || 18;
      const generatedCount = Math.floor(Math.random() * (countMax - countMin + 1)) + countMin;

      // Replace {count} in text
      let text = item.text.replace(/\{count\}/g, String(generatedCount));

      // Handle product title display
      let showProductTitle: string | null = null;
      if (item.productTitle) {
        // Only show productTitle on second line if not already mentioned in text
        if (!text.toLowerCase().includes(item.productTitle.toLowerCase())) {
          showProductTitle = item.productTitle;
        }
      }

      setActiveToast({
        text,
        icon: item.icon || "🔥",
        productTitle: showProductTitle,
      });

      // Animate In
      setVisible(true);

      // Display duration
      const displayMs = (config.displayDuration || 5) * 1000;

      displayTimeoutRef.current = setTimeout(() => {
        // Animate Out
        setVisible(false);

        hideTimeoutRef.current = setTimeout(() => {
          setActiveToast(null);

          // Calculate random next interval
          const minSec = config.intervalMin || 15;
          const maxSec = config.intervalMax || 30;
          const randomIntervalSec = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;

          intervalTimeoutRef.current = setTimeout(() => {
            scheduleNext();
          }, randomIntervalSec * 1000);
        }, 300); // 300ms transition time
      }, displayMs);
    };

    // First appearance after a short initial delay (e.g. 3 seconds)
    intervalTimeoutRef.current = setTimeout(() => {
      scheduleNext();
    }, 3000);

    return () => {
      if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
      if (intervalTimeoutRef.current) clearTimeout(intervalTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [config, pathname, storeSlug]);

  if (!activeToast) return null;

  return (
    <aside
      aria-live="polite"
      aria-atomic="true"
      className="fixed z-40 pointer-events-none select-none"
      style={{
        /* top-right: just below the studio header (~52px) + 8px gap */
        top: "calc(52px + 8px + env(safe-area-inset-top, 0px))",
        right: "12px",
        /* compact width — never full screen */
        width: "min(296px, calc(100vw - 24px))",
      }}
    >
      <div
        className={`
          relative overflow-hidden
          bg-[#16181f]/95 dark:bg-[#16181f]/95
          border border-white/10
          rounded-2xl shadow-xl
          backdrop-blur-md
          px-3.5 py-2.5
          flex items-start gap-2.5
          text-white
          transition-all duration-300 ease-out
          motion-reduce:transition-none
          ${visible
            ? "opacity-100 translate-x-0 scale-100"
            : "opacity-0 translate-x-3 scale-[0.97]"
          }
        `}
        role="status"
      >
        {/* Red accent left bar */}
        <span
          aria-hidden="true"
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-red-500/70"
        />

        {/* Icon — inline, no heavy box */}
        <span
          aria-hidden="true"
          className="text-[20px] leading-none mt-[1px] shrink-0"
        >
          {activeToast.icon}
        </span>

        {/* Text block */}
        <div className="flex flex-col min-w-0">
          <p className="text-[13px] font-semibold text-zinc-100 leading-snug break-words">
            {activeToast.text}
          </p>
          {activeToast.productTitle && (
            <p className="text-[11px] font-medium text-red-400 mt-0.5 truncate">
              {activeToast.productTitle}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

