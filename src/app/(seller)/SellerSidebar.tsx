"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronDown, ChevronUp, X, LogOut, ArrowLeft } from "lucide-react";
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
      {/* Top Header: Logo WebGran com Badge Vendedor */}
      <div className="h-16 px-4 sm:px-5 flex items-center justify-between border-b border-white/[0.06] shrink-0">
        <Link href="/seller" onClick={handleLinkClick} className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-[1px] shadow-sm shadow-emerald-500/20">
            <div className="w-full h-full bg-[#0B0D13] rounded-[11px] flex items-center justify-center">
              <span className="font-black text-xs text-white tracking-tighter">W</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-tight group-hover:text-emerald-400 transition-colors">
              WebGran
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Vendedor
            </span>
          </div>
        </Link>

        {isMobileDrawer && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navegação Principal com Scroll Invisível */}
      <nav
        tabIndex={0}
        aria-label="Navegação do Vendedor"
        className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-none focus-visible:outline-none"
      >
        {/* ==================================================== */}
        {/* SEÇÃO 1: GERAL                                       */}
        {/* ==================================================== */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold text-zinc-400 select-none">
            Geral
          </p>
          <SidebarNavItem
            href="/seller"
            label="Dashboard"
            isActive={pathname === "/seller"}
            icon={SolarSellerDashboardIcon}
            iconSize={18}
            accent="emerald"
            onClick={handleLinkClick}
          />
        </div>

        {/* ==================================================== */}
        {/* SEÇÃO 2: BOT TELEGRAM                                */}
        {/* ==================================================== */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold text-zinc-400 select-none">
            Bot Telegram
          </p>

          {/* Acordeão do Bot Telegram */}
          <button
            type="button"
            onClick={() => setUserManuallyToggledBot(!botGroupOpen)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
              isBotChildActive
                ? "bg-emerald-500/10 text-white font-semibold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <SolarSellerBotIcon
                size={18}
                className={`shrink-0 transition-colors ${
                  isBotChildActive ? "text-emerald-400" : "text-zinc-400"
                }`}
              />
              <span className="truncate">Configurações do Bot</span>
            </div>
            {botGroupOpen ? (
              <ChevronUp className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
            )}
          </button>

          {/* Subitens com recuo suave (sem linhas SVG manuais) */}
          {botGroupOpen && (
            <div className="pl-3 pt-1 space-y-0.5 border-l border-white/[0.06] ml-4 my-1">
              {visibleBotSubItems.map((subItem) => {
                const isSubActive =
                  pathname === subItem.href || pathname.startsWith(subItem.href + "/");

                return (
                  <SidebarNavItem
                    key={subItem.href}
                    href={subItem.href}
                    label={subItem.name}
                    isActive={isSubActive}
                    icon={subItem.icon}
                    iconSize={16}
                    accent="emerald"
                    onClick={handleLinkClick}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* SEÇÃO 3: VENDAS                                      */}
        {/* ==================================================== */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold text-zinc-400 select-none">
            Vendas
          </p>
          {salesItems.map((item) => {
            const isItemActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <SidebarNavItem
                key={item.href}
                href={item.href}
                label={item.name}
                isActive={isItemActive}
                icon={item.icon}
                iconSize={18}
                accent="emerald"
                onClick={handleLinkClick}
              />
            );
          })}
        </div>

        {/* ==================================================== */}
        {/* SEÇÃO 4: CONTA                                       */}
        {/* ==================================================== */}
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-semibold text-zinc-400 select-none">
            Conta
          </p>
          {accountItems.map((item) => {
            const isItemActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <SidebarNavItem
                key={item.href}
                href={item.href}
                label={item.name}
                isActive={isItemActive}
                icon={item.icon}
                iconSize={18}
                accent="emerald"
                onClick={handleLinkClick}
              />
            );
          })}
        </div>
      </nav>

      {/* ==================================================== */}
      {/* RODAPÉ: CARD DE VOLUME, VOLTAR AO ADMIN & USUÁRIO    */}
      {/* ==================================================== */}
      <div className="p-3 border-t border-white/[0.06] space-y-2 bg-[var(--seller-bg,#0B0D13)] shrink-0">
        
        {/* Card de Volume de Vendas (Clean & Apple HIG) */}
        <div className="p-3 rounded-xl bg-[#10121A] border border-white/[0.04] space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <SolarSellerSalesVolumeIcon size={16} className="text-emerald-400 shrink-0" />
              <span className="text-[11px] font-semibold text-zinc-200">
                Volume de vendas
              </span>
            </div>
            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">
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

            {/* Barra de Progresso Fina Esmeralda */}
            <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
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
            <SolarSellerBackToAdminIcon size={16} className="text-zinc-400 group-hover:text-emerald-400 shrink-0" />
            <span className="truncate flex-1">Voltar ao Admin</span>
          </Link>
        )}

        {/* Perfil do Vendedor & Logout */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-[#10121A] border border-white/[0.04]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center border border-white/10 shrink-0 font-bold text-xs text-white overflow-hidden">
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
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 ml-1"
            title="Sair da conta"
          >
            <SolarSellerLogoutIcon size={16} className="text-zinc-400 hover:text-rose-400 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}

