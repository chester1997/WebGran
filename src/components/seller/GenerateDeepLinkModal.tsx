"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Globe,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  Trash2,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface VideoTriggerItem {
  id: string;
  token: string;
  storeId: string;
  productId: string | null;
  videoId: string;
  type: "PUBLIC" | "PURCHASE";
  accessId: string | null;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  deepLink: string;
}

interface GenerateDeepLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: {
    id: string;
    title: string;
    status: string;
    durationSeconds?: number | null;
    thumbnailUrl?: string | null;
  } | null;
}

export function GenerateDeepLinkModal({
  isOpen,
  onClose,
  video,
}: GenerateDeepLinkModalProps) {
  const [accessType, setAccessType] = useState<"PUBLIC" | "PURCHASE">("PUBLIC");
  const [expirationType, setExpirationType] = useState<"NEVER" | "DATE">("NEVER");
  const [expirationDate, setExpirationDate] = useState<string>("");

  const [triggersList, setTriggersList] = useState<VideoTriggerItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const [createdDeepLink, setCreatedDeepLink] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch existing triggers for this video
  useEffect(() => {
    if (!isOpen || !video) return;

    setCreatedDeepLink(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoadingList(true);

    fetch(`/api/seller/videos/${video.id}/triggers`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.triggers)) {
          setTriggersList(data.triggers);
        }
      })
      .catch((err) => {
        console.error("[GenerateDeepLinkModal] Fetch triggers error:", err);
      })
      .finally(() => {
        setIsLoadingList(false);
      });
  }, [isOpen, video]);

  if (!isOpen || !video) return null;

  const handleGenerateLink = async () => {
    if (video.status !== "READY") {
      setErrorMsg("Somente vídeos no status PRONTO (READY) podem gerar Deep Links.");
      return;
    }

    setIsCreating(true);
    setErrorMsg(null);

    let expiresAt: string | null = null;
    if (expirationType === "DATE" && expirationDate) {
      expiresAt = new Date(expirationDate).toISOString();
    }

    try {
      const res = await fetch(`/api/seller/videos/${video.id}/triggers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: accessType,
          expiresAt,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Falha ao gerar Deep Link.");
      }

      setCreatedDeepLink(data.deepLink);
      setSuccessMsg("Deep Link gerado com sucesso!");
      
      // Refresh list
      fetch(`/api/seller/videos/${video.id}/triggers`)
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.triggers)) {
            setTriggersList(d.triggers);
          }
        });
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao gerar Deep Link.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeactivate = async (triggerId: string) => {
    setDeactivatingId(triggerId);
    try {
      const res = await fetch(`/api/seller/videos/${video.id}/triggers/${triggerId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Falha ao desativar link.");
      }

      setTriggersList((prev) =>
        prev.map((t) => (t.id === triggerId ? { ...t, active: false } : t))
      );
      setSuccessMsg("Deep Link desativado com sucesso.");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao desativar link.");
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleCopyLink = (link: string, token: string) => {
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0F0F12] border border-violet-500/20 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 relative space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-bold uppercase tracking-wider">
            <LinkIcon className="w-3.5 h-3.5" /> GERAR DEEP LINK DO TELEGRAM
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">{video.title}</h2>
          <p className="text-xs text-zinc-400">
            Crie um link opaco de acesso direto para divulgação pública ou exclusiva para compradores.
          </p>
        </div>

        {/* Toast Messages */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* FORM: ACCESS TYPE INFO (PUBLIC ONLY) */}
        <div className="space-y-3 bg-[#16161C] border border-white/5 rounded-2xl p-5">
          <label className="block text-xs font-extrabold text-white uppercase tracking-wider">
            COMO O CONTEÚDO SERÁ ACESSADO?
          </label>

          <div className="p-4 rounded-xl border border-violet-500 bg-violet-600/10 shadow-lg shadow-violet-500/5 flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-bold text-white">🌐 Público / Gratuito</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-normal">
              Qualquer pessoa com o link poderá assistir ao vídeo, sem precisar ter comprado o produto.
            </p>
          </div>
        </div>

        {/* FORM: EXPIRATION OPTION */}
        <div className="space-y-3 bg-[#16161C] border border-white/5 rounded-2xl p-5">
          <label className="block text-xs font-extrabold text-white uppercase tracking-wider">
            VALIDADE DO DEEP LINK
          </label>

          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
              <input
                type="radio"
                name="expiration"
                checked={expirationType === "NEVER"}
                onChange={() => setExpirationType("NEVER")}
                className="accent-violet-600"
              />
              <span>Sem expiração (indeterminado)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
              <input
                type="radio"
                name="expiration"
                checked={expirationType === "DATE"}
                onChange={() => setExpirationType("DATE")}
                className="accent-violet-600"
              />
              <span>Expira em data/hora específica</span>
            </label>
          </div>

          {expirationType === "DATE" && (
            <div className="pt-2">
              <input
                type="datetime-local"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="bg-[#121215] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
              />
            </div>
          )}
        </div>

        {/* ACTION BUTTON */}
        <Button
          onClick={handleGenerateLink}
          disabled={isCreating}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl py-3 shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Gerando Link...</span>
            </>
          ) : (
            <>
              <LinkIcon className="w-4 h-4" />
              <span>GERAR DEEP LINK</span>
            </>
          )}
        </Button>

        {/* RECENTLY CREATED LINK CARD */}
        {createdDeepLink && (
          <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Novo Deep Link Gerado
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {accessType === "PUBLIC" ? "PÚBLICO" : "COMPRADORES"}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={createdDeepLink}
                className="w-full bg-[#121215] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 select-all"
              />
              <Button
                onClick={() => handleCopyLink(createdDeepLink, "new")}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 rounded-xl shrink-0 font-bold"
              >
                {copiedToken === "new" ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedToken === "new" ? "Copiado!" : "Copiar"}
              </Button>
              <a
                href={createdDeepLink}
                target="_blank"
                rel="noreferrer"
                className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 rounded-xl shrink-0 flex items-center justify-center"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}

        {/* EXISTING LINKS LIST */}
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">
            LINKS GERADOS PARA ESTE VÍDEO ({triggersList.length})
          </h4>

          {isLoadingList ? (
            <div className="py-6 text-center text-xs text-zinc-500 font-mono">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-violet-400" />
              Carregando links...
            </div>
          ) : triggersList.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-2">
              Nenhum Deep Link gerado para este vídeo ainda.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {triggersList.map((trig) => {
                const isExpired = trig.expiresAt && new Date() > new Date(trig.expiresAt);
                const isInactive = !trig.active;

                return (
                  <div
                    key={trig.id}
                    className="bg-[#16161C] border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            trig.type === "PUBLIC"
                              ? "bg-violet-600/20 text-violet-400 border border-violet-500/30"
                              : "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {trig.type === "PUBLIC" ? "Público" : "Compradores"}
                        </span>

                        {isInactive ? (
                          <span className="text-[10px] bg-red-950 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold">
                            Inativo
                          </span>
                        ) : isExpired ? (
                          <span className="text-[10px] bg-orange-950 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full font-bold">
                            Expirado
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                            Ativo
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-mono text-zinc-300 truncate">{trig.deepLink}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyLink(trig.deepLink, trig.id)}
                        className="bg-[#121215] border-white/10 text-xs text-zinc-300 hover:text-white rounded-lg px-2.5 py-1"
                      >
                        {copiedToken === trig.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>

                      <a
                        href={trig.deepLink}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#121215] border border-white/10 text-xs text-zinc-300 hover:text-white rounded-lg p-1.5 flex items-center justify-center"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {trig.active && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeactivate(trig.id)}
                          disabled={deactivatingId === trig.id}
                          className="bg-red-950/40 border-red-500/30 text-xs text-red-400 hover:bg-red-900/50 rounded-lg px-2.5 py-1"
                          title="Desativar link"
                        >
                          {deactivatingId === trig.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <PowerOff className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
