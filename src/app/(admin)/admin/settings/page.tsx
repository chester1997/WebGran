import { requireAdmin } from "@/lib/auth";
import Link from "next/link";

export default async function AdminSettingsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Configurações Globais</h2>
      
      <div className="bg-card border rounded-md p-6 max-w-2xl space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Tema Padrão do Sistema</h3>
          <p className="text-muted-foreground text-sm mb-4">
            A configuração do tema padrão determina qual layout será automaticamente aplicado quando um novo Lojista criar uma loja ou conectar um bot.
            Os lojistas não possuem permissão para trocar temas.
          </p>
          
          <div className="p-4 bg-muted/30 border rounded-md">
            <p className="text-sm">
              Para alterar o tema padrão, acesse a aba <Link href="/admin/themes" className="text-blue-500 hover:underline">Temas</Link> e clique em "Definir Padrão" no card do tema desejado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
