import 'dotenv/config';
import { db } from './index';
import { orders } from './schema';
import { eq, inArray } from 'drizzle-orm';

async function main() {
  console.log("=== CANCELANDO VENDAS DE TESTE DA CONTABILIDADE ===");

  const orderIdsToCancel = [
    'e776a1e1-e013-4113-a90a-3aadce3badd5', // #e776a1e1
    '00eb49f2-39ec-4975-a7bd-3a2251e8558f', // #00eb49f2
  ];

  for (const id of orderIdsToCancel) {
    const existing = await db.query.orders.findFirst({
      where: eq(orders.id, id)
    });

    if (existing) {
      console.log(`Encontrada Order ${id} (Status atual: ${existing.status}, Total: R$ ${existing.total})`);
      await db.update(orders)
        .set({
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(eq(orders.id, id));
      console.log(`-> Order ${id} alterada para status 'cancelled'.`);
    } else {
      console.warn(`Order ${id} não encontrada no banco.`);
    }
  }

  console.log("\nAtualização concluída com sucesso!");
}

main().catch(console.error).finally(() => process.exit(0));
