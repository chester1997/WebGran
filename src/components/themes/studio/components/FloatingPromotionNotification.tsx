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
      className="fixed z-40 pointer-events-none select-none overflow-hidden right-0 pr-3"
      style={{
        top: "calc(52px + 8px + env(safe-area-inset-top, 0px))",
        maxWidth: "100vw",
      }}
    >
      <div
        className={`
          relative overflow-hidden
          w-[min(265px,calc(100vw-24px))]
          rounded-2xl
          px-[11px] py-[9px]
          flex items-start gap-[8px]
          transition-all duration-300
          motion-reduce:transform-none motion-reduce:transition-opacity
          
          /* Liquid Glass Background - Dark Mode default */
          bg-[rgba(20,20,25,0.52)]
          border border-white/14
          shadow-[0_12px_35px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]
          text-zinc-100
          
          /* Liquid Glass Background - Light Mode (.light parent override) */
          [.light_&]:bg-[rgba(255,255,255,0.60)]
          [.light_&]:border-[rgba(255,255,255,0.65)]
          [.light_&]:shadow-[0_10px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.80)]
          [.light_&]:text-zinc-900

          /* Real Glass Backdrop Blur */
          backdrop-blur-[20px] backdrop-saturate-[150%]
          [-webkit-backdrop-filter:blur(20px)_saturate(150%)]

          /* Glass Reflection Glare Overlay */
          before:absolute before:inset-0 before:pointer-events-none
          before:bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02)_40%,transparent_70%)]
          [.light_&]:before:bg-[linear-gradient(135deg,rgba(255,255,255,0.45),rgba(255,255,255,0.12)_40%,transparent_70%)]

          ${visible
            ? "translate-x-0 scale-100 opacity-100 ease-[cubic-bezier(0.22,1,0.36,1)]"
            : "translate-x-[calc(100%+24px)] scale-[0.98] opacity-0 ease-[cubic-bezier(0.4,0,0.2,1)]"
          }
        `}
        role="status"
      >
        {/* Subtle Accent Left Pillar Bar */}
        <span
          aria-hidden="true"
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
        />

        {/* Icon — inline, integrated directly into text flow */}
        <span
          aria-hidden="true"
          className="text-[19px] leading-none mt-[1px] shrink-0"
        >
          {activeToast.icon}
        </span>

        {/* Text content block */}
        <div className="flex flex-col min-w-0 flex-1 relative z-10">
          <p className="text-[13px] font-semibold leading-[1.25] text-zinc-100 [.light_&]:text-zinc-900 break-words drop-shadow-sm">
            {activeToast.text}
          </p>
          {activeToast.productTitle && (
            <p className="text-[11px] font-semibold text-red-400 [.light_&]:text-red-500 mt-0.5 truncate">
              {activeToast.productTitle}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}



