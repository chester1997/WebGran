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
    <div className="flex-1 flex flex-col justify-between h-full min-h-0 bg-[var(--seller-bg,#0B0F14)]">
      {/* ==================================================== */}
      {/* BRAND HEADER (Logo 38px, WebGran 21px/700, Vendedor 10px) */}
      {/* ==================================================== */}
      <div className="px-[22px] pt-6 pb-4 flex items-center justify-between shrink-0 select-none">
        <Link href="/seller" onClick={handleLinkClick} className="flex items-center gap-3 min-w-0">
          <Image
            src="/logo-webgran-icon.png"
            alt="WebGran"
            width={40}
            height={40}
            priority
            className="w-[38px] h-[38px] rounded-full object-contain shrink-0"
          />
          <span className="font-[700] text-[21px] text-white tracking-tight whitespace-nowrap">
            WebGran
          </span>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/25 rounded-lg tracking-wider uppercase">
            VENDEDOR
          </span>
          {isMobileDrawer && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* NAVEGAÇÃO PRINCIPAL (px-[22px] py-2 space-y-2)      */}
      {/* ==================================================== */}
      <nav
        tabIndex={0}
        aria-label="Navegação do Vendedor"
        className="flex-1 overflow-y-auto px-[22px] py-2 sidebar-scroll focus-visible:outline-none"
      >
        {/* ==================================================== */}
        {/* SEÇÃO 1: GERAL                                       */}
        {/* ==================================================== */}
        <div className="pt-1">
          <div className="px-1 pb-2 flex items-center gap-2.5 select-none">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400 shrink-0">
              GERAL
            </span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <div className="space-y-2 mt-1">
            <SidebarNavItem
              href="/seller"
              label="Dashboard"
              isActive={pathname === "/seller"}
              onClick={handleLinkClick}
              icon={SolarSellerDashboardIcon}
              iconSize={19}
              accent="blue"
            />
          </div>
        </div>

        {/* ==================================================== */}
        {/* SEÇÃO 2: BOT TELEGRAM                                */}
        {/* ==================================================== */}
        <div className="mt-[36px]">
          <div className="px-1 pb-2 flex items-center gap-2.5 select-none">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400 shrink-0">
              BOT TELEGRAM
            </span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <div className="space-y-2 mt-1">
            {/* Acordeão do Bot Telegram estilizado */}
            <SidebarNavItem
              label="Configurações do Bot"
              isActive={isBotChildActive}
              icon={SolarSellerBotIcon}
              iconSize={19}
              accent="blue"
              onClick={() => setUserManuallyToggledBot(!botGroupOpen)}
              className={`w-full flex items-center justify-between gap-2.5 px-3 h-[44px] min-h-[44px] rounded-[10px] text-[14px] font-medium text-left transition-all duration-150 cursor-pointer ${
                isBotChildActive
                  ? "bg-[#3984FF]/10 text-white font-medium"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {botGroupOpen ? (
                <ChevronUp className="w-4 h-4 shrink-0 text-zinc-400 transition-transform duration-150 ml-1.5" strokeWidth={1.8} />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0 text-zinc-500 transition-transform duration-150 ml-1.5" strokeWidth={1.8} />
              )}
            </SidebarNavItem>

            {/* Subitens com árvore de conexão SVG */}
            {botGroupOpen && (
              <div className="relative pl-5 space-y-2 my-2">
                {visibleBotSubItems.map((item, index) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  const isLast = index === visibleBotSubItems.length - 1;

                  return (
                    <div key={item.href} className="relative flex items-center">
                      <svg className="absolute -left-3 top-0 bottom-0 w-3.5 h-full pointer-events-none" overflow="visible">
                        <line x1="0" y1="0" x2="0" y2={isLast ? "16" : "100%"} stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" />
                        <path d="M 0 0 V 8 Q 0 16 6 16 H 10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" strokeLinecap="round" />
                      </svg>

                      <SidebarNavItem
                        href={item.href}
                        label={item.name}
                        isActive={isActive}
                        onClick={handleLinkClick}
                        icon={item.icon}
                        iconSize={17}
                        accent="blue"
                        iconClassName={`w-[17px] h-[17px] shrink-0 transition-colors ${isActive ? "text-[#3984FF]" : "text-zinc-400"}`}
                        className={`w-full flex items-center gap-3 px-3 py-2 min-h-[40px] rounded-[10px] text-[14px] font-medium transition-all duration-150 relative ${
                          isActive
                            ? "bg-[#3984FF]/10 text-white font-medium"
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
        <div className="mt-[36px]">
          <div className="px-1 pb-2 flex items-center gap-2.5 select-none">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400 shrink-0">
              VENDAS
            </span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <div className="space-y-2 mt-1">
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
                  iconSize={19}
                  accent="blue"
                />
              );
            })}
          </div>
        </div>

        {/* ==================================================== */}
        {/* SEÇÃO 4: CONTA                                       */}
        {/* ==================================================== */}
        <div className="mt-[36px]">
          <div className="px-1 pb-2 flex items-center gap-2.5 select-none">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400 shrink-0">
              CONTA
            </span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <div className="space-y-2 mt-1">
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
                  iconSize={19}
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
      <div className="px-[22px] py-4 border-t border-white/[0.06] space-y-3 bg-[var(--seller-bg,#0B0F14)] shrink-0">
        
        {/* Card de Volume de Vendas */}
        <div className="p-3.5 rounded-[12px] bg-[#0F1014] border border-white/[0.06] space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-300">
              <SolarSellerSalesVolumeIcon size={19} className="text-[#3984FF] shrink-0" />
              <span className="text-[13px] font-medium text-zinc-200">
                Volume de vendas
              </span>
            </div>
            <span className="text-[12px] font-bold font-mono px-2 py-0.5 rounded-md bg-[#3984FF]/10 text-[#3984FF] border border-[#3984FF]/20 tabular-nums">
              {percentage.toFixed(0)}%
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between font-mono tabular-nums">
              <span className="font-bold text-white text-[13px] tracking-tight">
                {formattedRevenue}
              </span>
              <span className="text-[12px] text-zinc-400">
                / {formattedGoal}
              </span>
            </div>

            {/* Barra de Progresso Fina Azul */}
            <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#3984FF] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Botão "Voltar ao Admin" */}
        {isAdminOrSuperAdmin && (
          <Link
            href="/admin"
            onClick={handleLinkClick}
            className="flex items-center gap-3 px-3 h-[44px] min-h-[44px] rounded-[10px] text-[14px] font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            <SolarSellerBackToAdminIcon size={19} className="text-zinc-400 shrink-0" />
            <span className="truncate flex-1">Voltar ao Admin</span>
          </Link>
        )}

        {/* Perfil do Vendedor & Logout */}
        <div className="flex items-center justify-between p-3 rounded-[12px] bg-[#0F1014] border border-white/[0.06]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-[38px] h-[38px] rounded-xl bg-[#1D4ED8] flex items-center justify-center border border-[#3984FF]/30 shrink-0 font-bold text-[14px] text-white overflow-hidden">
              {sellerProfile?.avatarUrl ? (
                <img src={sellerProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                initialLetter
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-white truncate leading-tight">
                {sellerProfile?.name || "Vendedor"}
              </p>
              <p className="text-[12px] text-zinc-400 truncate mt-0.5 leading-tight">
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
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 ml-1"
            title="Sair da conta"
          >
            <SolarSellerLogoutIcon size={19} className="text-zinc-400 hover:text-rose-400 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
