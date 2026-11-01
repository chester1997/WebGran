"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import SidebarNavItem from "@/components/layout/SidebarNavItem";
import {
  SolarSellerDashboardIcon,
  SolarSellerBotIcon,
  SolarSellerWelcomeIcon,
  SolarSellerBannersIcon,
  SolarSellerProductsIcon,
  SolarSellerCombosIcon,
  SolarSellerVideosIcon,
  SolarSellerCarouselsIcon,
  SolarSellerCategoriesIcon,
  SolarSellerClipsIcon,
  SolarSellerNotificationsIcon,
  SolarSellerCouponsIcon,
  SolarSellerOrdersIcon,
  SolarSellerFinanceIcon,
  SolarSellerCustomersIcon,
  SolarSellerGatewaysIcon,
  SolarSellerSettingsIcon,
  SolarSellerBackToAdminIcon,
  SolarSellerLogoutIcon,
  SolarSellerSalesVolumeIcon,
} from "@/components/icons/solar/seller-icons";

export interface SellerProfileData {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role?: string;
}

interface SellerSidebarProps {
  sellerProfile: SellerProfileData | null;
  totalRevenue: number;
  salesGoal?: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  isMobileDrawer?: boolean;
}

export default function SellerSidebar({
  sellerProfile,
  totalRevenue,
  salesGoal = 15000.0,
  onCloseMobile,
  isMobileDrawer = false,
}: SellerSidebarProps) {
  const pathname = usePathname();

  // Subitens do Bot Telegram
  const botTelegramSubItems = [
    { name: "Configuração", href: "/seller/store", icon: SolarSellerBotIcon },
    { name: "Boas-vindas", href: "/seller/boas-vindas", icon: SolarSellerWelcomeIcon },
    { name: "Banners", href: "/seller/banners", icon: SolarSellerBannersIcon },
    { name: "Produtos", href: "/seller/products", icon: SolarSellerProductsIcon },
    { name: "Combos", href: "/seller/combos", icon: SolarSellerCombosIcon },
    { name: "Biblioteca de Vídeos", href: "/seller/videos", icon: SolarSellerVideosIcon },
    { name: "Carrosséis", href: "/seller/carousels", icon: SolarSellerCarouselsIcon },
    { name: "Categorias", href: "/seller/categories", icon: SolarSellerCategoriesIcon },
    { name: "Clips", href: "/seller/bot/clips", icon: SolarSellerClipsIcon },
    { name: "Notificações", href: "/seller/bot/notifications", icon: SolarSellerNotificationsIcon },
    { name: "Cupons", href: "/seller/coupons", icon: SolarSellerCouponsIcon },
  ];

  // Subitens de Vendas
  const salesItems = [
    { name: "Pedidos", href: "/seller/orders", icon: SolarSellerOrdersIcon },
    { name: "Financeiro", href: "/seller/financeiro", icon: SolarSellerFinanceIcon },
    { name: "Clientes", href: "/seller/customers", icon: SolarSellerCustomersIcon },
  ];

  // Subitens de Conta
  const accountItems = [
    { name: "Gateways", href: "/seller/recebimentos", icon: SolarSellerGatewaysIcon },
    { name: "Configurações", href: "/seller/settings", icon: SolarSellerSettingsIcon },
  ];

  const isAdminOrSuperAdmin = sellerProfile?.role === "admin" || sellerProfile?.role === "super_admin";

  const visibleBotSubItems = botTelegramSubItems.filter((item) => {
    if (item.href === "/seller/categories") {
      return isAdminOrSuperAdmin;
    }
    return true;
  });

  const isBotChildActive = visibleBotSubItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const [userManuallyToggledBot, setUserManuallyToggledBot] = useState<boolean | null>(null);

  // Reset toggle override ao navegar
  useEffect(() => {
    setUserManuallyToggledBot(null);
  }, [pathname]);

  const botGroupOpen = userManuallyToggledBot !== null ? userManuallyToggledBot : isBotChildActive;

  // Métricas do volume de vendas
  const percentage = Math.min(100, Math.max(0, (totalRevenue / salesGoal) * 100));
  const formattedRevenue = totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formattedGoal = salesGoal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const initialLetter = (sellerProfile?.name || sellerProfile?.email || "V").charAt(0).toUpperCase();

  const handleLinkClick = () => {
    if (isMobileDrawer && onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between h-full min-h-0 bg-[var(--seller-bg,#0B0D13)]">
      {/* ==================================================== */}
      {/* BRAND HEADER (Idêntico ao Admin: px-6 md:px-7)      */}
      {/* ==================================================== */}
      <div className="px-6 md:px-7 pt-6 md:pt-7 pb-4 md:pb-5 flex items-center justify-between shrink-0 select-none">
        <Link href="/seller" onClick={handleLinkClick} className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Image
            src="/logo-webgran-icon.png"
            alt="WebGran"
            width={40}
            height={40}
            priority
            className="w-9 h-9 md:w-10 md:h-10 rounded-full object-contain shrink-0"
          />
          <span className="font-semibold text-[17px] md:text-[18px] text-white tracking-tight whitespace-nowrap">
            WebGran
          </span>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] md:text-[10px] font-bold bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25 rounded-lg tracking-wider uppercase">
            VENDEDOR
          </span>
          {isMobileDrawer && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* NAVEGAÇÃO PRINCIPAL (px-6 md:px-7 py-3 space-y-1)   */}
      {/* ==================================================== */}
      <nav
        tabIndex={0}
        aria-label="Navegação do Vendedor"
        className="flex-1 overflow-y-auto px-6 md:px-7 py-3 space-y-1 sidebar-scroll focus-visible:outline-none"
      >
        {/* ==================================================== */}
        {/* SEÇÃO 1: GERAL                                       */}
        {/* ==================================================== */}
        <div className="pt-2">
          <div className="px-3 pb-1 flex items-center gap-2.5 select-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 shrink-0">
              GERAL
            </span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <div className="space-y-0.5">
            <SidebarNavItem
              href="/seller"
              label="Dashboard"
              isActive={pathname === "/seller"}
              onClick={handleLinkClick}
              icon={SolarSellerDashboardIcon}
              accent="blue"
            />
          </div>
        </div>

        {/* ==================================================== */}
        {/* SEÇÃO 2: BOT TELEGRAM                                */}
        {/* ==================================================== */}
        <div className="pt-3 mt-2">
          <div className="px-3 pb-1 flex items-center gap-2.5 select-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 shrink-0">
              BOT TELEGRAM
            </span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <div className="space-y-0.5">
            {/* Acordeão do Bot Telegram estilizado idêntico ao Admin */}
            <SidebarNavItem
              label="Configurações do Bot"
              isActive={isBotChildActive}
              icon={SolarSellerBotIcon}
              accent="blue"
              onClick={() => setUserManuallyToggledBot(!botGroupOpen)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 min-h-[40px] rounded-lg text-xs font-medium text-left transition-all duration-150 cursor-pointer ${
                isBotChildActive
                  ? "bg-[#3984FF]/10 text-white font-semibold"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {botGroupOpen ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform duration-150" strokeWidth={1.8} />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-150" strokeWidth={1.8} />
              )}
            </SidebarNavItem>

            {/* Subitens com árvore de conexão SVG idêntica ao Admin */}
            {botGroupOpen && (
              <div className="relative pl-6 space-y-1 my-1">
                {visibleBotSubItems.map((item, index) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const isLast = index === visibleBotSubItems.length - 1;

                  return (
                    <div key={item.href} className="relative flex items-center">
                      <svg className="absolute -left-3.5 top-0 bottom-0 w-4 h-full pointer-events-none" overflow="visible">
                        <line x1="0" y1="0" x2="0" y2={isLast ? "14" : "100%"} stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" />
                        <path d="M 0 0 V 8 Q 0 14 6 14 H 12" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" strokeLinecap="round" />
                      </svg>

                      <SidebarNavItem
                        href={item.href}
                        label={item.name}
                        isActive={isActive}
                        onClick={handleLinkClick}
                        icon={item.icon}
                        iconSize={14}
                        accent="blue"
                        iconClassName={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? "text-[#3984FF]" : "text-zinc-400"}`}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 min-h-[38px] rounded-lg text-xs font-medium transition-all duration-150 relative ${
                          isActive
                            ? "bg-[#3984FF]/10 text-white font-semibold"
                            : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ==================================================== */}
        {/* SEÇÃO 3: VENDAS                                      */}
        {/* ==================================================== */}
        <div className="pt-3 mt-2">
          <div className="px-3 pb-1 flex items-center gap-2.5 select-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 shrink-0">
              VENDAS
            </span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <div className="space-y-0.5">
            {salesItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  label={item.name}
                  isActive={isActive}
                  onClick={handleLinkClick}
                  icon={item.icon}
                  accent="blue"
                />
              );
            })}
          </div>
        </div>

        {/* ==================================================== */}
        {/* SEÇÃO 4: CONTA                                       */}
        {/* ==================================================== */}
        <div className="pt-3 mt-2">
          <div className="px-3 pb-1 flex items-center gap-2.5 select-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 shrink-0">
              CONTA
            </span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <div className="space-y-0.5">
            {accountItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  label={item.name}
                  isActive={isActive}
                  onClick={handleLinkClick}
                  icon={item.icon}
                  accent="blue"
                />
              );
            })}
          </div>
        </div>
      </nav>

      {/* ==================================================== */}
      {/* RODAPÉ: CARD DE VOLUME, VOLTAR AO ADMIN & USUÁRIO    */}
      {/* ==================================================== */}
      <div className="px-6 md:px-7 py-4 border-t border-white/[0.06] space-y-2.5 bg-[var(--seller-bg,#0B0D13)] shrink-0">
        
        {/* Card de Volume de Vendas */}
        <div className="p-3 rounded-lg bg-[#0F1014] border border-white/[0.06] space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <SolarSellerSalesVolumeIcon size={16} className="text-[#3984FF] shrink-0" />
              <span className="text-[11px] font-semibold text-zinc-200">
                Volume de vendas
              </span>
            </div>
            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/20">
              {percentage.toFixed(0)}%
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-xs font-mono tabular-nums">
              <span className="font-bold text-white text-xs tracking-tight">
                {formattedRevenue}
              </span>
              <span className="text-[10px] text-zinc-400">
                / {formattedGoal}
              </span>
            </div>

            {/* Barra de Progresso Fina Azul */}
            <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#3984FF] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Botão Sutil "Voltar ao Admin" (para administradores em impersonação) */}
        {isAdminOrSuperAdmin && (
          <Link
            href="/admin"
            onClick={handleLinkClick}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            <SolarSellerBackToAdminIcon size={16} className="text-zinc-400 shrink-0" />
            <span className="truncate flex-1">Voltar ao Admin</span>
          </Link>
        )}

        {/* Perfil do Vendedor & Logout */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0F1014] border border-white/[0.06]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#1D4ED8] flex items-center justify-center border border-[#3984FF]/30 shrink-0 font-bold text-[11px] text-white overflow-hidden">
              {sellerProfile?.avatarUrl ? (
                <img src={sellerProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initialLetter
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {sellerProfile?.name || "Vendedor"}
              </p>
              <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                {sellerProfile?.email || "vendedor@webgran.online"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isMobileDrawer && onCloseMobile) onCloseMobile();
              signOut({ callbackUrl: "/login" });
            }}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 ml-1"
            title="Sair da conta"
          >
            <SolarSellerLogoutIcon size={16} className="text-zinc-400 hover:text-rose-400 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
