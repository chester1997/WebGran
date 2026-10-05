"use client";

import Link from "next/link";
import { Film, HardDrive, ShieldCheck, Users, ArrowRight, Layers, Sparkles } from "lucide-react";

export default function VideoLibraryOverviewClient({ user }: { user: any }) {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-violet-900/40 via-purple-900/30 to-zinc-900 p-6 rounded-2xl border border-violet-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-violet-600/20 rounded-xl border border-violet-500/30 text-violet-400">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Biblioteca de Vídeos — Visão Geral
              </h1>
              <p className="text-sm text-zinc-400">
                Painel administrativo exclusivo para gestão da infraestrutura e planos de armazenamento de vídeos.
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/admin/video-library/plans"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl shadow-lg shadow-violet-600/30 transition-all cursor-pointer"
        >
          <HardDrive className="w-4 h-4" />
          <span>Planos de Armazenamento</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900/70 border border-zinc-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>Infraestrutura de Mídia</span>
            <Film className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-xl font-bold text-white">Bunny Stream CDN</div>
          <p className="text-xs text-zinc-500">Video Transcoding, TUS Uploads & DRM Player</p>
        </div>

        <div className="bg-zinc-900/70 border border-zinc-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>Gestão Quotas GB</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white">Entitlement & StorageUsage</div>
          <p className="text-xs text-zinc-500">Monitoramento atômico por vendedor</p>
        </div>

        <div className="bg-zinc-900/70 border border-zinc-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium uppercase tracking-wider">
            <span>Regra de Isenção</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-300">ADMIN_EXEMPT</div>
          <p className="text-xs text-zinc-500">Super Admins possuem cota Ilimitada (-1 GB)</p>
        </div>
      </div>

      {/* Overview Info Block */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h2 className="text-lg font-bold text-white">Módulos da Biblioteca de Vídeos</h2>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          A Biblioteca de Vídeos permite aos produtores e vendedores armazenar episódios, séries e conteúdos no Bunny Stream para entrega automática de produtos digitais no Mini App Telegram e WebGran.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <Link
            href="/admin/video-library/plans"
            className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 hover:border-violet-500/50 transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white group-hover:text-violet-400 transition-colors flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-violet-400" />
                Planos de Armazenamento
              </span>
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
            <p className="text-xs text-zinc-400">
              Configure planos de 20 GB, 100 GB, 500 GB ou Ilimitado, definindo preços e periodicidade comercial.
            </p>
          </Link>

          <Link
            href="/admin/plans"
            className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 hover:border-red-500/50 transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white group-hover:text-red-400 transition-colors flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-400" />
                Planos WebGran
              </span>
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
            <p className="text-xs text-zinc-400">
              Gerencie pacotes completos da plataforma WebGran com permissões de produtos, bots, temas e vídeos.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
