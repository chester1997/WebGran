import { getCurrentStore } from "@/lib/auth";
import { db } from "@/db";
import { telegramCustomers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function CustomersPage() {
  const store = await getCurrentStore();
  const items = store ? await db.query.telegramCustomers.findMany({
    where: eq(telegramCustomers.storeId, store.id)
  }) : [];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Clientes do Telegram</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Telegram ID</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhum cliente cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                  <TableCell>{c.username ? `@${c.username}` : '-'}</TableCell>
                  <TableCell>{c.telegramUserId}</TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
