"use client";

import React from "react";
import Link from "next/link";
import { UserCircle } from "lucide-react";
import { useTelegram } from "@/app/miniapp/Providers";

interface StudioHeaderProps {
  storeSlug: string;
  storeName: string;
  headerLogoUrl: string | null;
}

export function StudioHeader({ storeSlug, storeName: _storeName, headerLogoUrl: _headerLogoUrl }: StudioHeaderProps) {
  const { user } = useTelegram();

  const tgUser = user as { photo_url?: string; first_name?: string } | null;
  const userPhoto = tgUser?.photo_url || null;
  const userInitial = tgUser?.first_name ? tgUser.first_name.charAt(0).toUpperCase() : null;

  return (
    <header className="shrink-0 sticky top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between bg-[#0d0e10]/95 backdrop-blur-md border-b border-white/5 shadow-md">
      <Link href={`/miniapp/${storeSlug}/profile`} className="flex items-center justify-center">
        {userPhoto ? (
          <img src={userPhoto} alt="Perfil" className="w-8 h-8 rounded-full object-cover border border-white/20 shadow-md" />
        ) : userInitial ? (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white border border-white/20">
            {userInitial}
          </div>
        ) : (
          <UserCircle className="w-7 h-7 text-zinc-300 hover:text-white transition-colors" />
        )}
      </Link>
    </header>
  );
}
