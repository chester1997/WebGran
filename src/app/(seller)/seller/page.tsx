import { requireSeller, getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { products, orders, telegramCustomers } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Users, Package } from "lucide-react";

export default async function SellerDashboardPage() {
  await requireSeller();
  const store = await getCurrentStore();

  let productsCount = 0;
  let ordersCount = 0;
  let customersCount = 0;

  if (store) {
    const pResult = await db.select({ value: count() }).from(products).where(eq(products.storeId, store.id));
    productsCount = pResult[0].value;

    const oResult = await db.select({ value: count() }).from(orders).where(eq(orders.storeId, store.id));
    ordersCount = oResult[0].value;

    const cResult = await db.select({ value: count() }).from(telegramCustomers).where(eq(telegramCustomers.storeId, store.id));
    customersCount = cResult[0].value;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
      
      {!store && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          Você ainda não possui uma loja configurada. Acesse as configurações para criar.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">+0% em relação a ontem</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordersCount}</div>
            <p className="text-xs text-muted-foreground">Total de pedidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customersCount}</div>
            <p className="text-xs text-muted-foreground">Cadastrados no bot</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productsCount}</div>
            <p className="text-xs text-muted-foreground">Cadastrados na loja</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
