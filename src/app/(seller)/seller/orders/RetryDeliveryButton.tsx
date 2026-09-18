"use client";

import { useState } from "react";
import { retryDeliveryAction } from "./actions";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryDeliveryButton({ accessId }: { accessId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const handleRetry = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await retryDeliveryAction(accessId);
      if (res.status === "ACTIVE") {
        setResult({ success: true });
      } else {
        setResult({ success: false, error: res.error || "Falha na tentativa de entrega." });
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message || "Erro de servidor." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        onClick={handleRetry}
        disabled={loading}
        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 h-7 text-[11px] px-2.5 rounded-md font-medium"
      >
        <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Tentando..." : "Tentar novamente"}
      </Button>
      {result?.success && (
        <span className="text-emerald-400 text-xs flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Entregue!
        </span>
      )}
      {result?.error && (
        <span className="text-red-400 text-[10px] truncate max-w-[150px]" title={result.error}>
          {result.error}
        </span>
      )}
    </div>
  );
}
