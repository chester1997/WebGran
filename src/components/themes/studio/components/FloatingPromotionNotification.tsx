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
      className="fixed z-40 pointer-events-none transition-all duration-300 left-3 right-3 sm:left-auto sm:right-4 bottom-[calc(68px+env(safe-area-inset-bottom,0px)+12px)] sm:bottom-6 sm:max-w-xs"
    >
      <div
        className={`transform transition-all duration-300 ease-out bg-[#14151C]/95 backdrop-blur-md border border-white/10 shadow-2xl rounded-2xl p-3 flex items-center gap-3 text-white pointer-events-none select-none ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-95"
        }`}
      >
        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 text-lg shadow-inner">
          {activeToast.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-100 leading-tight">
            {activeToast.text}
          </p>
          {activeToast.productTitle && (
            <p className="text-[11px] font-bold text-red-400 truncate mt-0.5">
              {activeToast.productTitle}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
