import { getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProduct } from "../actions";
import { Badge } from "@/components/ui/badge";

export default async function ProductsPage() {
  const store = await getCurrentStore();
  const items = store ? await db.query.products.findMany({
    where: eq(products.storeId, store.id)
  }) : [];
  
  const storeCategories = store ? await db.query.categories.findMany({
    where: eq(categories.storeId, store.id)
  }) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Produtos</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Novo Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createProduct} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input id="price" name="price" type="number" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compareAtPrice">Preço Antigo</Label>
                  <Input id="compareAtPrice" name="compareAtPrice" type="number" step="0.01" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shortDescription">Descrição Curta</Label>
                <Input id="shortDescription" name="shortDescription" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição Completa</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coverUrl">URL da Capa</Label>
                <Input id="coverUrl" name="coverUrl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bannerUrl">URL do Banner</Label>
                <Input id="bannerUrl" name="bannerUrl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoria</Label>
                <select id="categoryId" name="categoryId" className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Sem categoria</option>
                  {storeCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Posição</Label>
                  <Input id="position" name="position" type="number" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select id="status" name="status" className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="active">Ativo</option>
                    <option value="draft">Rascunho</option>
                    <option value="archived">Arquivado</option>
                  </select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={!store}>Criar Produto</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Produtos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Nenhum produto encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {items.map((prod) => (
                  <TableRow key={prod.id}>
                    <TableCell className="font-medium">{prod.title}</TableCell>
                    <TableCell>R$ {Number(prod.price).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={prod.status === 'active' ? 'default' : 'secondary'}>
                        {prod.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" disabled>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
