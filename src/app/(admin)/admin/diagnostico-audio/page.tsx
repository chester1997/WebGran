import { requireAdmin } from "@/lib/auth";
import { AudioDiagnosticPanel } from "@/components/audio/AudioDiagnosticPanel";

export const metadata = {
  title: "Diagnóstico de Áudio | WebGran Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAudioDiagnosticPage() {
  await requireAdmin();

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-white tracking-tight">
          Diagnóstico e Validação de Áudio
        </h1>
        <p className="text-xs text-zinc-400">
          Ferramenta administrativa restrita para depuração técnica de autoplay, Web Audio e notificações push no celular ou desktop.
        </p>
      </div>

      <AudioDiagnosticPanel />
    </div>
  );
}

