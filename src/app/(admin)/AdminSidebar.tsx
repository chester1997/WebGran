"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Bot,
  Package,
  ShoppingCart,
  UserCheck,
  Palette,
  Settings,
  Menu,
  X,
  LogOut,
  Store,
  CreditCard,
  Sliders,
  Film,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Coins,
  Camera,
  Trash2,
  Lock,
  Check,
  AlertCircle,
  Loader2,
  UserCog,
  BarChart3,
  Wallet
} from "lucide-react";
import { signOut } from "next-auth/react";

interface AdminUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
}

interface AdminSidebarProps {
  user: AdminUser;
}

export default function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminUser>(user);

  const hamburgerButtonRef = useRef<HTMLButtonElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevMobileOpenRef = useRef(mobileOpen);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  // Drawer accessibility: manage focus and Escape key
  useEffect(() => {
    if (mobileOpen) {
      const focusTarget = closeButtonRef.current || sidebarRef.current;
      focusTarget?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setMobileOpen(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    } else if (prevMobileOpenRef.current && !mobileOpen) {
      hamburgerButtonRef.current?.focus();
    }
    prevMobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  // Section 1: BOT
  const botItems = [
    { label: "Bots", href: "/admin/bots", icon: Bot },
  ];

  // Section 2: VENDAS
  const salesItems = [
    { label: "Pedidos", href: "/admin/orders", icon: ShoppingCart },
    { label: "Clientes", href: "/admin/customers", icon: UserCheck },
    { label: "Vendedores e Taxas", href: "/admin/sellers", icon: Users },
    { label: "Comissão da Plataforma", href: "/admin/commission", icon: Coins },
    { label: "Relatórios", href: "/admin/reports", icon: BarChart3 },
  ];

  // Section 3: PLATAFORMA
  const platformItems = [
    { label: "Planos WebGran", href: "/admin/plans", icon: Package },
    { label: "Assinaturas WebGran", href: "/admin/subscriptions", icon: CreditCard },
    { label: "Recursos & Features", href: "/admin/features", icon: Sliders },
    { label: "Gateways dos Vendedores", href: "/admin/seller-gateways", icon: Wallet },
  ];

  // Submenu: Biblioteca de Vídeos
  const videoLibraryItems = [
    { label: "Visão Geral", href: "/admin/video-library", icon: Film },
    { label: "Planos de Armazenamento", href: "/admin/video-library/plans", icon: HardDrive },
  ];

  const isVideoActive = videoLibraryItems.some(
    (i) => pathname === i.href || (i.href !== "/admin/video-library" && pathname.startsWith(i.href))
  );
  const [userVideoToggled, setUserVideoToggled] = useState<boolean | null>(null);
  const videoOpen = userVideoToggled !== null ? userVideoToggled : isVideoActive;

  useEffect(() => {
    setUserVideoToggled(null);
    setMobileOpen(false);
  }, [pathname]);

  const handleProfileUpdated = (updated: { name: string; avatarUrl: string | null }) => {
    setCurrentUser((prev) => ({
      ...prev,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
    }));
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0B0B0E] border-b border-white/[0.07] text-white z-30 w-full flex-shrink-0 shadow-md">
        <div className="flex items-center gap-2 font-bold text-base tracking-tight">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-white">WebGran</span>
          <span className="text-[10px] bg-blue-500/10 text-blue-500 font-bold px-2 py-0.5 rounded border border-blue-500/20 tracking-wider">
            ADMIN
          </span>
        </div>
        <button
          ref={hamburgerButtonRef}
          id="admin-mobile-menu-trigger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="admin-sidebar-drawer"
          aria-label={mobileOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
          className="p-1.5 rounded-lg bg-[#15171D] text-zinc-300 hover:text-white border border-white/[0.06] active:scale-95 transition-all cursor-pointer"
        >
          {mobileOpen ? <X className="w-5 h-5 text-blue-500" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Backdrop for Mobile */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="admin-sidebar-drawer"
        ref={sidebarRef}
        tabIndex={-1}
        aria-label="Navegação Administrativa"
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-60 md:w-64 h-full bg-[#0B0B0E] md:bg-[#0A0C10]
          border-r border-white/[0.06] md:border-r-0 md:border-none
          rounded-none md:rounded-none shadow-2xl md:shadow-none
          flex-shrink-0 flex flex-col overflow-hidden
          transition-transform duration-200 ease-in-out outline-none
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Brand Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.06]">
          <Link href="/admin" className="flex items-center" onClick={() => setMobileOpen(false)}>
            <img
              src="/logo-expanded.png"
              alt="WebGran Logo"
              className="h-8 w-auto max-w-[150px] object-contain"
            />
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-md tracking-wider uppercase">
              ADMIN
            </span>
            <button
              ref={closeButtonRef}
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1 custom-scrollbar">
          {/* Dashboard (Root Item) */}
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative
              ${pathname === "/admin"
                ? "bg-[#15171D] text-white border border-white/[0.08] shadow-xs font-semibold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
              }
            `}
          >
            {pathname === "/admin" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
            )}
            <LayoutDashboard className={`w-4 h-4 transition-colors ${pathname === "/admin" ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
            <span className="truncate">Dashboard</span>
          </Link>

          {/* ==================================================== */}
          {/* SECTION: BOT */}
          {/* ==================================================== */}
          <div className="pt-3 mt-2 border-t border-white/[0.06]">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 select-none">
              BOT
            </div>
            <div className="space-y-0.5">
              {botItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative
                      ${isActive
                        ? "bg-[#15171D] text-white border border-white/[0.08] shadow-xs font-semibold"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                      }
                    `}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                    )}
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ==================================================== */}
          {/* SECTION: VENDAS */}
          {/* ==================================================== */}
          <div className="pt-3 mt-2 border-t border-white/[0.06]">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 select-none">
              VENDAS
            </div>
            <div className="space-y-0.5">
              {salesItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative
                      ${isActive
                        ? "bg-[#15171D] text-white border border-white/[0.08] shadow-xs font-semibold"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                      }
                    `}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                    )}
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ==================================================== */}
          {/* SECTION: PLATAFORMA */}
          {/* ==================================================== */}
          <div className="pt-3 mt-2 border-t border-white/[0.06]">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 select-none">
              PLATAFORMA
            </div>
            <div className="space-y-0.5">
              {platformItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative
                      ${isActive
                        ? "bg-[#15171D] text-white border border-white/[0.08] shadow-xs font-semibold"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                      }
                    `}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                    )}
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}

              {/* Submenu Expansível: Biblioteca de Vídeos */}
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setUserVideoToggled(!videoOpen)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isVideoActive ? "text-white font-semibold bg-[#15171D] border border-white/[0.08]" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Film className={`w-4 h-4 shrink-0 transition-colors ${isVideoActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                    <span className="truncate">Biblioteca de Vídeos</span>
                  </div>
                  {videoOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 shrink-0 text-zinc-400 transition-transform duration-150" strokeWidth={1.8} />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-150" strokeWidth={1.8} />
                  )}
                </button>

                {videoOpen && (
                  <div className="relative pl-6 space-y-1 my-1">
                    {videoLibraryItems.map((item, index) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href || (item.href !== "/admin/video-library" && pathname.startsWith(item.href));
                      const isLast = index === videoLibraryItems.length - 1;

                      return (
                        <div key={item.href} className="relative flex items-center">
                          <svg className="absolute -left-3.5 top-0 bottom-0 w-4 h-full pointer-events-none" overflow="visible">
                            <line x1="0" y1="0" x2="0" y2={isLast ? "14" : "100%"} stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" />
                            <path d="M 0 0 V 8 Q 0 14 6 14 H 12" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.25" strokeLinecap="round" />
                          </svg>

                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                              isActive
                                ? "bg-[#15171D] text-white font-semibold border border-white/[0.08] shadow-xs"
                                : "bg-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                            }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                            )}
                            <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                            <span className="truncate flex-1">{item.label}</span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Temas */}
              <Link
                href="/admin/themes"
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative
                  ${pathname === "/admin/themes"
                    ? "bg-[#15171D] text-white border border-white/[0.08] shadow-xs font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                  }
                `}
              >
                {pathname === "/admin/themes" && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                )}
                <Palette className={`w-4 h-4 transition-colors ${pathname === "/admin/themes" ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                <span className="truncate">Temas</span>
              </Link>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SECTION: CONTA */}
          {/* ==================================================== */}
          <div className="pt-3 mt-2 border-t border-white/[0.06]">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 select-none">
              CONTA
            </div>
            <div className="space-y-1">
              {/* Configurações */}
              <Link
                href="/admin/settings"
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative
                  ${pathname === "/admin/settings"
                    ? "bg-[#15171D] text-white border border-white/[0.08] shadow-xs font-semibold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                  }
                `}
              >
                {pathname === "/admin/settings" && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-blue-500 rounded-r-full shadow-sm shadow-blue-500/50" />
                )}
                <Settings className={`w-4 h-4 transition-colors ${pathname === "/admin/settings" ? "text-blue-500" : "text-zinc-400"}`} strokeWidth={1.8} />
                <span className="truncate">Configurações</span>
              </Link>

              {/* Store Access Button for Platform Owner */}
              <Link
                href="/seller"
                onClick={() => setMobileOpen(false)}
                className="
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium
                  text-emerald-400 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.15] hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/35
                  transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 group
                "
              >
                <Store className="w-4 h-4 text-emerald-400 group-hover:scale-105 transition-all shrink-0" strokeWidth={1.8} />
                <span className="truncate">Painel do Vendedor</span>
              </Link>
            </div>
          </div>
        </nav>

        {/* User Footer Card */}
        <div className="p-2.5 border-t border-white/[0.06]">
          <div
            onClick={() => setProfileModalOpen(true)}
            className="flex items-center justify-between p-2 rounded-xl bg-[#0F1014] hover:bg-[#15171D] border border-white/[0.06] hover:border-white/15 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name || "Avatar"}
                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-blue-500/30 bg-[#0E0E12]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-[11px] shrink-0 border border-white/20">
                  {currentUser?.name?.[0]?.toUpperCase() || "A"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate group-hover:text-blue-300 transition-colors">
                  {currentUser?.name || "Administrador"}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">
                  {currentUser?.email || "admin@webgran.online"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileModalOpen(true);
                }}
                title="Editar Perfil"
                className="p-1 rounded-md text-zinc-400 hover:text-blue-500 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <UserCog className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  signOut({ callbackUrl: "/login" });
                }}
                title="Sair"
                className="p-1 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Admin Profile Modal */}
      {profileModalOpen && (
        <AdminProfileModal
          user={currentUser}
          onClose={() => setProfileModalOpen(false)}
          onSave={handleProfileUpdated}
        />
      )}
    </>
  );
}

// ====================================================
// ADMIN PROFILE EDIT MODAL
// ====================================================

interface AdminProfileModalProps {
  user: AdminUser;
  onClose: () => void;
  onSave: (updated: { name: string; avatarUrl: string | null }) => void;
}

function AdminProfileModal({ user, onClose, onSave }: AdminProfileModalProps) {
  const [name, setName] = useState(user.name || "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatarUrl || null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check MIME type
    const validMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validMimes.includes(file.type)) {
      setErrorMsg("Formato inválido. Use apenas PNG, JPEG ou WebP.");
      return;
    }

    // Check size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("A imagem selecionada excede o limite máximo de 5MB.");
      return;
    }

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPreviewUrl(result);
      setAvatarChanged(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setPreviewUrl(null);
    setAvatarChanged(true);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setErrorMsg("O nome de exibição é obrigatório.");
      return;
    }
    if (trimmed.length < 2 || trimmed.length > 80) {
      setErrorMsg("O nome deve ter entre 2 e 80 caracteres.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: { name: string; avatarUrl?: string | null } = {
        name: trimmed,
      };

      if (avatarChanged) {
        payload.avatarUrl = previewUrl; // data URL or null
      }

      const res = await fetch("/api/admin/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao salvar perfil.");
      }

      setSuccessMsg("Perfil atualizado com sucesso!");
      onSave({
        name: data.user.name,
        avatarUrl: data.user.avatarUrl,
      });

      // Also dispatch a custom window event for instant update across tabs/components
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("webgran-admin-profile-updated", { detail: data.user }));
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error("[Admin Profile Save Error]:", err);
      setErrorMsg(err.message || "Erro de conexão ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={() => !isSaving && onClose()}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-[#0F1014] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in-0 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#0F1014]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <UserCog className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Perfil Administrativo</h2>
              <p className="text-[11px] text-zinc-400">Gerencie seus dados e foto de perfil</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Error & Success Feedback */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Avatar Section */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-[#15171D] border border-white/[0.06]">
            <div className="relative shrink-0">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Pré-visualização do Avatar"
                  className="w-14 h-14 rounded-full object-cover border-2 border-blue-500/50 bg-[#0E0E12] shadow-md"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xl border-2 border-blue-400/40 shadow-md">
                  {name?.[0]?.toUpperCase() || "A"}
                </div>
              )}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <span className="text-xs font-semibold text-white block">Foto de Perfil</span>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Alterar</span>
                </button>

                {previewUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={isSaving}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 border border-white/[0.08] hover:border-red-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover</span>
                  </button>
                )}
              </div>
              <span className="text-[10px] text-zinc-400 block">
                PNG, JPEG ou WebP (máx. 5MB)
              </span>
            </div>
          </div>

          {/* Display Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 block">
              Nome de Exibição <span className="text-blue-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Luiz Fernando"
              maxLength={80}
              required
              disabled={isSaving}
              className="w-full px-3 py-2 bg-[#15171D] border border-white/[0.08] focus:border-blue-500 text-white text-xs rounded-xl focus:outline-none transition-all placeholder:text-zinc-400 disabled:opacity-50"
            />
          </div>

          {/* Email (Read-Only) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 block">
                E-mail
              </label>
              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Somente leitura
              </span>
            </div>
            <input
              type="email"
              value={user.email || ""}
              readOnly
              disabled
              className="w-full px-3 py-2 bg-[#15171D] border border-white/[0.04] text-zinc-400 text-xs rounded-xl cursor-not-allowed select-none"
            />
          </div>

          {/* Role & ID (Read-Only Info) */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Nível de Permissão:</span>
            <span className="font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              Super Administrador WebGran
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
