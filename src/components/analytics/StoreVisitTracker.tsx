"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTelegram } from "@/app/miniapp/Providers";

interface StoreVisitTrackerProps {
  storeSlug: string;
}

export function getClientSessionId(storeSlug: string): string {
  if (typeof window === "undefined") return "";
  try {
    const key = `wg_sid_${storeSlug}`;
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      // Check cookie
      const match = document.cookie.match(new RegExp(`(^| )${key}=([^;]+)`));
      if (match && match[2]) {
        sid = match[2];
      }
    }
    if (!sid) {
      sid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    sessionStorage.setItem(key, sid);
    document.cookie = `${key}=${sid}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `wg_session_id=${sid}; path=/; max-age=86400; SameSite=Lax`;
    (window as any).__WG_SESSION_ID__ = sid;
    return sid;
  } catch (_e) {
    return "";
  }
}

export function StoreVisitTracker({ storeSlug }: StoreVisitTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useTelegram();
  const trackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !storeSlug) return;

    const currentPath = pathname || window.location.pathname;
    // Don't re-track the exact same path in the same component lifecycle unless parameters changed
    const trackKey = `${currentPath}?${searchParams?.toString() || ""}`;
    if (trackedPathRef.current === trackKey) return;
    trackedPathRef.current = trackKey;

    const sessionId = getClientSessionId(storeSlug);
    if (!sessionId) return;

    // Detect device type
    const isMobile =
      typeof window !== "undefined" &&
      (window.innerWidth < 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent));
    const deviceType = isMobile ? "mobile" : "desktop";

    // Extract UTM parameters
    const utmSource = searchParams?.get("utm_source") || null;
    const utmMedium = searchParams?.get("utm_medium") || null;
    const utmCampaign = searchParams?.get("utm_campaign") || null;
    const utmContent = searchParams?.get("utm_content") || null;
    const utmTerm = searchParams?.get("utm_term") || null;

    // Extract Telegram start_param if available
    const startParam =
      (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param ||
      searchParams?.get("tgWebAppStartParam") ||
      searchParams?.get("start_param") ||
      null;

    const rawUserId =
      (user as any)?.id ||
      (user as any)?.telegramUserId ||
      (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id ||
      null;

    const payload = {
      sessionId,
      storeSlug,
      entryPath: currentPath,
      referrer: document.referrer || null,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      startParam,
      telegramUserId: rawUserId ? String(rawUserId) : null,
      deviceType,
    };

    fetch("/api/analytics/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn("[StoreVisitTracker] Visit tracking failed non-critically:", err?.message);
    });
  }, [storeSlug, pathname, searchParams, user]);

  return null;
}
