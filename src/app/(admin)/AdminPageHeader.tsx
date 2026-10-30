"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface AdminPageHeaderProps {
  children: ReactNode;
  portalId?: string;
}

export default function AdminPageHeader({
  children,
  portalId = "admin-page-header-portal",
}: AdminPageHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const target = document.getElementById(portalId);
    if (target) {
      setPortalTarget(target);
    }
    setMounted(true);
  }, [portalId]);

  if (!mounted || !portalTarget) {
    return null;
  }

  return createPortal(children, portalTarget);
}

