import { getCurrentStore } from "@/lib/auth";
import { updateStoreSettings } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default async function StoreSettingsPage() {
  const store = await getCurrentStore();

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-3xl font-bold tracking-tight">Minha Loja</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Loja</CardTitle>
          <CardDescription>Atualize as informações públicas da sua loja no Telegram.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateStoreSettings} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Loja</Label>
              <Input id="name" name="name" defaultValue={store?.name || ""} required />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL única)</Label>
              <Input id="slug" name="slug" defaultValue={store?.slug || ""} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">URL da Logo</Label>
              <Input id="logoUrl" name="logoUrl" defaultValue={store?.logoUrl || ""} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" name="description" defaultValue={store?.description || ""} rows={4} />
            </div>

            <Button type="submit">Salvar Alterações</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
