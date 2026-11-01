"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AdminScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    const mainEl = document.querySelector("main[aria-label='Conteúdo Principal']");
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [pathname]);

  return null;
}

