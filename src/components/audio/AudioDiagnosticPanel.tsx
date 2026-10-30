"use client";

import { useState, useEffect } from "react";
import {
  Volume2,
  Play,
  RotateCcw,
  Activity,
  Terminal,
  Radio,
  Music,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";
import {
  DiagnosticLogEntry,
  getAudioDiagnosticLogs,
  clearAudioDiagnosticLogs,
  recordAudioLog,
  getOrCreateAudioContext,
  unlockAudioContext,
  playCommissionChime,
  synthesizeChimeFallback,
} from "@/lib/sound/notification-sound";
import { COMMISSION_AUDIO_DATA_URI } from "@/lib/sound/commission-audio-data";

export function AudioDiagnosticPanel() {
  const [logs, setLogs] = useState<DiagnosticLogEntry[]>([]);
  const [contextState, setContextState] = useState<string>("desconhecido");
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  const refreshState = () => {
    setLogs(getAudioDiagnosticLogs());
    if (typeof window !== "undefined") {
      const ctx = getOrCreateAudioContext();
      setContextState(ctx?.state || "não suportado");
    }
  };

  useEffect(() => {
    refreshState();

    const handleLog = (e: any) => {
      if (e?.detail) {
        setLogs((prev) => [e.detail, ...prev.slice(0, 49)]);
      }
      if (typeof window !== "undefined") {
        const ctx = getOrCreateAudioContext();
        if (ctx) setContextState(ctx.state);
      }
    };

    const handleClear = () => {
      setLogs([]);
    };

    window.addEventListener("webgran-audio-log", handleLog);
    window.addEventListener("webgran-audio-log-clear", handleClear);

    return () => {
      window.removeEventListener("webgran-audio-log", handleLog);
      window.removeEventListener("webgran-audio-log-clear", handleClear);
    };
  }, []);

  // 1. TESTE 1: Reprodução Direta MP3 (HTML5 Audio Síncrono)
  const handleTestDirectMp3 = async () => {
    setIsPlaying("direct");
    recordAudioLog("TESTE_ISOLADO", "Iniciando Teste 1: Reprodução Direta HTML5 Audio (síncrona)...", "info");

    try {
      // Disparo síncrono no primeiro tick do clique do usuário
      const audio = new Audio(COMMISSION_AUDIO_DATA_URI);
      audio.volume = 1.0;
      audio.muted = false;

      recordAudioLog("5_HTML5_PLAY", `audio.play() direto invocado. Volume: ${audio.volume}, Muted: ${audio.muted}`, "info");

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise;
        recordAudioLog("8_RESULTADO", "Teste 1 (Direto HTML5) executado com sucesso!", "success");
      }
    } catch (err: any) {
      recordAudioLog("6_ERRO_REJEICAO", `Teste 1 (Direto HTML5) falhou: [${err?.name}] ${err?.message}`, "error");
    } finally {
      setTimeout(() => setIsPlaying(null), 800);
      refreshState();
    }
  };

  // 2. TESTE 2: Reprodução via Web Audio Context (Buffer decodificado)
  const handleTestWebAudio = async () => {
    setIsPlaying("webaudio");
    recordAudioLog("TESTE_ISOLADO", "Iniciando Teste 2: Reprodução via Web Audio Context (Buffer)...", "info");

    try {
      const ctx = getOrCreateAudioContext();
      if (!ctx) {
        throw new Error("Web Audio API indisponível neste navegador.");
      }

      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      setContextState(ctx.state);

      // Decodifica a partir do Base64
      const base64Data = COMMISSION_AUDIO_DATA_URI.split(",")[1];
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.9, ctx.currentTime);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);

      recordAudioLog("8_RESULTADO", `Teste 2 (Web Audio Buffer) disparado com sucesso (${audioBuffer.duration.toFixed(2)}s)!`, "success");
    } catch (err: any) {
      recordAudioLog("6_ERRO_REJEICAO", `Teste 2 (Web Audio Buffer) falhou: [${err?.name}] ${err?.message}`, "error");
    } finally {
      setTimeout(() => setIsPlaying(null), 800);
      refreshState();
    }
  };

  // 3. TESTE 3: Reprodução pelo botão "Testar Som" padrão
  const handleTestCommissionChime = async () => {
    setIsPlaying("chime");
    recordAudioLog("TESTE_ISOLADO", "Iniciando Teste 3: Invocação de playCommissionChime({ force: true })...", "info");

    try {
      // Cria instância síncrona no primeiro tick do clique
      const audioInstance = new Audio(COMMISSION_AUDIO_DATA_URI);
      const success = await playCommissionChime({
        force: true,
        eventId: `diag-chime-${Date.now()}`,
        synchronousAudioInstance: audioInstance,
      });

      if (success) {
        recordAudioLog("8_RESULTADO", "Teste 3 (Botão Testar Som) concluído com sucesso!", "success");
      } else {
        recordAudioLog("8_RESULTADO", "Teste 3 retornou false.", "warn");
      }
    } catch (err: any) {
      recordAudioLog("6_ERRO_REJEICAO", `Teste 3 falhou com exceção: ${err?.message}`, "error");
    } finally {
      setTimeout(() => setIsPlaying(null), 800);
      refreshState();
    }
  };

  // 4. TESTE 4: Simulação de Evento Real de Notificação (Push disparado pelo Service Worker)
  const handleTestSimulatedRealEvent = async () => {
    setIsPlaying("real");
    recordAudioLog("1_EVENTO", "Iniciando Teste 4: Simulando evento real WEBGRAN_PUSH_RECEIVED vindo do Service Worker...", "info");

    try {
      // Simula a chegada da mensagem que o sw.js envia para a janela aberta
      const simulatedPayload = {
        title: "💰 Venda Aprovada! R$ 97,00",
        body: "WebGran • Comprovante recebido no split Pix",
        tag: `test-sale-${Date.now()}`,
        data: {
          orderId: `diag-order-${Date.now()}`,
          url: "/seller/financeiro",
        },
      };

      recordAudioLog("1_EVENTO", `Payload de evento simulado recebido no cliente (Pedido: ${simulatedPayload.data.orderId})`, "info", simulatedPayload);

      // Dispara a reprodução exatamente como o listener de primeiro plano faz
      const played = await playCommissionChime({ eventId: simulatedPayload.data.orderId });

      if (played) {
        recordAudioLog("8_RESULTADO", "Teste 4 (Evento Real Simulado) concluído com sucesso!", "success");
      } else {
        recordAudioLog("8_RESULTADO", "Teste 4 falhou ou foi bloqueado por política de autoplay fora de clique.", "warn");
      }
    } catch (err: any) {
      recordAudioLog("6_ERRO_REJEICAO", `Teste 4 falhou: ${err?.message}`, "error");
    } finally {
      setTimeout(() => setIsPlaying(null), 800);
      refreshState();
    }
  };

  return (
    <div className="bg-[#121214] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Laboratório de Diagnóstico de Áudio</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                AudioContext: {contextState}
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Teste isolado por etapas para identificar exatamente onde o som falha no seu navegador/Android.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={clearAudioDiagnosticLogs}
          className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Limpar Logs</span>
        </button>
      </div>

      {/* Grade de 4 Testes Comparativos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {/* Teste 1: Direto HTML5 */}
        <button
          type="button"
          onClick={handleTestDirectMp3}
          disabled={isPlaying !== null}
          className="p-3.5 rounded-xl bg-[#18181C] hover:bg-[#202026] border border-white/5 hover:border-blue-500/30 text-left transition-all space-y-2 cursor-pointer disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-blue-400">
            <Music className="w-4 h-4" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10">Teste 1</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">
              {isPlaying === "direct" ? "Reproduzindo..." : "1. HTML5 Direto (MP3)"}
            </span>
            <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
              Disparo síncrono via tag Audio nativa.
            </span>
          </div>
        </button>

        {/* Teste 2: Web Audio Buffer */}
        <button
          type="button"
          onClick={handleTestWebAudio}
          disabled={isPlaying !== null}
          className="p-3.5 rounded-xl bg-[#18181C] hover:bg-[#202026] border border-white/5 hover:border-emerald-500/30 text-left transition-all space-y-2 cursor-pointer disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-emerald-400">
            <Volume2 className="w-4 h-4" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10">Teste 2</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">
              {isPlaying === "webaudio" ? "Reproduzindo..." : "2. Web Audio (Buffer)"}
            </span>
            <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
              Decodificação em memória via AudioContext.
            </span>
          </div>
        </button>

        {/* Teste 3: Botão Testar Som */}
        <button
          type="button"
          onClick={handleTestCommissionChime}
          disabled={isPlaying !== null}
          className="p-3.5 rounded-xl bg-[#18181C] hover:bg-[#202026] border border-white/5 hover:border-purple-500/30 text-left transition-all space-y-2 cursor-pointer disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-purple-400">
            <Play className="w-4 h-4" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10">Teste 3</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">
              {isPlaying === "chime" ? "Reproduzindo..." : "3. Botão 'Testar Som'"}
            </span>
            <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
              Executa a mesma função das preferências.
            </span>
          </div>
        </button>

        {/* Teste 4: Evento Real Simulado */}
        <button
          type="button"
          onClick={handleTestSimulatedRealEvent}
          disabled={isPlaying !== null}
          className="p-3.5 rounded-xl bg-[#18181C] hover:bg-[#202026] border border-white/5 hover:border-amber-500/30 text-left transition-all space-y-2 cursor-pointer disabled:opacity-50"
        >
          <div className="flex items-center justify-between text-amber-400">
            <Radio className="w-4 h-4" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10">Teste 4</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">
              {isPlaying === "real" ? "Simulando..." : "4. Evento Real (Push SW)"}
            </span>
            <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
              Simula o evento de venda chegando do SW.
            </span>
          </div>
        </button>
      </div>

      {/* Terminal de Logs em Tempo Real */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
          <span className="flex items-center gap-1.5 font-mono text-[11px]">
            <Terminal className="w-3.5 h-3.5 text-zinc-500" />
            Registro de Execução e Erros ({logs.length} eventos)
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">
            Últimas chamadas gravadas
          </span>
        </div>

        <div className="bg-[#0A0A0C] border border-white/5 rounded-xl p-3 max-h-56 overflow-y-auto font-mono text-[11px] space-y-1.5 shadow-inner">
          {logs.length === 0 ? (
            <div className="text-zinc-600 italic py-3 text-center">
              Nenhum evento registrado ainda. Clique em um dos botões acima para executar os testes.
            </div>
          ) : (
            logs.map((log, index) => {
              const color =
                log.level === "success"
                  ? "text-emerald-400"
                  : log.level === "error"
                  ? "text-rose-400 bg-rose-500/5 p-1 rounded"
                  : log.level === "warn"
                  ? "text-amber-400"
                  : "text-zinc-300";

              const Icon =
                log.level === "success"
                  ? CheckCircle2
                  : log.level === "error"
                  ? XCircle
                  : log.level === "warn"
                  ? AlertTriangle
                  : Info;

              return (
                <div key={index} className={`flex items-start gap-2 ${color} leading-tight`}>
                  <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-zinc-500 select-none mr-2">[{log.timestamp}]</span>
                    <span className="font-bold mr-1.5">[{log.step}]</span>
                    <span>{log.message}</span>
                    {log.details && (
                      <pre className="text-[10px] text-zinc-500 mt-0.5 overflow-x-auto">
                        {typeof log.details === "string" ? log.details : JSON.stringify(log.details)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

