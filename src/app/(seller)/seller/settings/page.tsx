import { getCurrentStore } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  await getCurrentStore();

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-3xl font-bold tracking-tight">Configurações</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Acesso e Plano</CardTitle>
          <CardDescription>Gerencie o plano da sua loja na plataforma WebGran.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Plano Atual</p>
            <p className="font-medium text-lg">Gratuito (MVP)</p>
          </div>
          <Button variant="outline" disabled>Fazer Upgrade (Em breve)</Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Avançado</CardTitle>
          <CardDescription>Ações destrutivas e perigosas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>Excluir Loja</Button>
        </CardContent>
      </Card>
    </div>
  );
}
