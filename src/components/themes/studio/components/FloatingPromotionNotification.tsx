"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

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
    if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
    if (intervalTimeoutRef.current) clearTimeout(intervalTimeoutRef.current);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);

    setVisible(false);
    setActiveToast(null);

    if (!config || !config.enabled || !config.notifications || config.notifications.length === 0) {
      return;
    }

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

      const item = config.notifications[activeIndex % config.notifications.length];
      activeIndex++;

      const countMin = item.countMin || 5;
      const countMax = item.countMax || 18;
      const generatedCount = Math.floor(Math.random() * (countMax - countMin + 1)) + countMin;

      let text = item.text.replace(/\{count\}/g, String(generatedCount));

      let showProductTitle: string | null = null;
      if (item.productTitle) {
        if (!text.toLowerCase().includes(item.productTitle.toLowerCase())) {
          showProductTitle = item.productTitle;
        }
      }

      setActiveToast({
        text,
        icon: item.icon || "🔥",
        productTitle: showProductTitle,
      });

      setVisible(true);

      const displayMs = (config.displayDuration || 5) * 1000;

      displayTimeoutRef.current = setTimeout(() => {
        setVisible(false);

        hideTimeoutRef.current = setTimeout(() => {
          setActiveToast(null);

          const minSec = config.intervalMin || 15;
          const maxSec = config.intervalMax || 30;
          const randomIntervalSec = Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec;

          intervalTimeoutRef.current = setTimeout(() => {
            scheduleNext();
          }, randomIntervalSec * 1000);
        }, 220);
      }, displayMs);
    };

    intervalTimeoutRef.current = setTimeout(() => {
      scheduleNext();
    }, 3000);

    return () => {
      if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
      if (intervalTimeoutRef.current) clearTimeout(intervalTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [config, pathname, storeSlug]);

  const handleClose = () => {
    setVisible(false);
    if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
  };

  if (!activeToast) return null;

  return (
    <aside
      aria-live="polite"
      aria-atomic="true"
      className="fixed z-40 pointer-events-none select-none right-3"
      style={{
        top: "calc(54px + 10px + env(safe-area-inset-top, 0px))",
      }}
    >
      <div
        role="status"
        className={`
          pointer-events-auto relative overflow-hidden
          w-[calc(100vw-24px)] max-w-[280px]
          min-h-[54px] max-h-[68px]
          rounded-2xl px-3 py-2.5
          flex items-center gap-2.5
          transition-all duration-200 cubic-bezier(0.16, 1, 0.3, 1)
          motion-reduce:transform-none motion-reduce:transition-opacity

          /* Liquid Glass Background - Light & Dark Mode */
          bg-white/80 dark:bg-zinc-900/80
          border border-white/60 dark:border-white/12
          backdrop-blur-xl backdrop-saturate-150
          shadow-[0_6px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.30)]

          ${
            visible
              ? "translate-x-0 opacity-100"
              : "translate-x-3 opacity-0"
          }
        `}
      >
        {/* Left Icon Area (32px) */}
        <div className="w-8 h-8 rounded-xl shrink-0 bg-zinc-100 dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center text-sm shadow-sm">
          {activeToast.icon}
        </div>

        {/* Text Content */}
        <div className="flex flex-col min-w-0 flex-1 pr-4">
          <p className="text-[11px] font-semibold leading-tight text-zinc-900 dark:text-zinc-100 truncate">
            {activeToast.text}
          </p>
          {activeToast.productTitle && (
            <p className="text-[10px] font-medium leading-tight text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {activeToast.productTitle}
            </p>
          )}
        </div>

        {/* Close Button ("×") */}
        <button
          onClick={handleClose}
          type="button"
          aria-label="Fechar notificação"
          className="absolute top-1.5 right-1.5 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
