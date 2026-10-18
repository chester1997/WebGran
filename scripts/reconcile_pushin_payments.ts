import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
}

async function reconcile() {
  const { db } = await import("../src/db");
  const { orders, accesses, sellerPaymentConnections, paymentWebhookEvents } = await import("../src/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { pushinPayProvider } = await import("../src/lib/payments/providers/pushinpay");
  const { AccessDeliveryService } = await import("../src/lib/delivery/access-delivery-service");
  const { decrypt } = await import("../src/lib/encryption");

  console.log("=== INICIANDO RECONCILIAÇÃO SEGURA DE PAGAMENTOS PUSHINPAY ===");

  const storeId = "06d519fb-615c-4854-8d79-dbac678289f1"; // Meus Doraminhas

  const conn = await db.query.sellerPaymentConnections.findFirst({
    where: and(
      eq(sellerPaymentConnections.storeId, storeId),
      eq(sellerPaymentConnections.provider, "pushinpay"),
      eq(sellerPaymentConnections.status, "active")
    )
  });

  if (!conn || !conn.accessTokenEncrypted) {
    throw new Error("Conexão PushinPay ativa não encontrada para a loja.");
  }

  const token = decrypt(conn.accessTokenEncrypted);

  const pendingOrders = await db.query.orders.findMany({
    where: and(
      eq(orders.storeId, storeId),
      eq(orders.status, "pending")
    ),
    with: {
      customer: true,
      items: {
        with: {
          product: true
        }
      }
    }
  });

  console.log(`Encontrados ${pendingOrders.length} pedidos com status 'pending'.`);

  const reconciledPaid: any[] = [];
  const markedExpired: any[] = [];

  for (const order of pendingOrders) {
    console.log(`\nVerificando Pedido: ${order.id} | Metodo: ${order.paymentMethod} | Total: R$ ${order.total}`);

    if (order.paymentMethod === 'pushinpay' && order.paymentId) {
      try {
        const tx = await pushinPayProvider.getPixPaymentStatus(order.paymentId, token);
        if (!tx) {
          console.log(`  -> Não localizado na PushinPay API.`);
          continue;
        }

        const txStatus = String(tx.status || '').toLowerCase().trim();
        const expectedCents = Math.round(Number(order.total) * 100);
        const receivedCents = Number(tx.value);
        const idMatches = String(tx.id).toLowerCase().trim() === String(order.paymentId).toLowerCase().trim();

        console.log(`  -> PushinPay Status: ${txStatus} | Valor: ${receivedCents} centavos (Esperado: ${expectedCents}) | ID confere: ${idMatches}`);

        if (txStatus === 'paid' && idMatches && receivedCents === expectedCents) {
          console.log(`  -> EVIDÊNCIA CONFIÁVEL: Pagamento comprovado na API oficial da PushinPay! (EndToEndId: ${tx.end_to_end_id})`);

          // 1. Gravar evento de webhook para idempotência
          const eventId = `reconcile_pushin_${order.paymentId}_paid`;
          try {
            await db.insert(paymentWebhookEvents).values({
              provider: 'pushinpay',
              eventId,
              eventType: 'paid',
              connectionId: conn.id,
              payload: tx
            });
          } catch {
            // ignore unique conflict
          }

          // 2. Transição atômica de status para 'paid'
          const updated = await db.update(orders)
            .set({
              status: 'paid',
              paidAt: new Date(tx.updated_at || Date.now()),
              updatedAt: new Date(),
            })
            .where(and(
              eq(orders.id, order.id),
              eq(orders.status, 'pending')
            ))
            .returning();

          if (updated.length > 0) {
            console.log(`  -> Pedido ${order.id} atualizado para 'paid'!`);

            // 3. Execução idempotente da entrega de acesso no Telegram
            console.log(`  -> Processando entrega de acessos via AccessDeliveryService...`);
            const deliveryRes = await AccessDeliveryService.processOrderDelivery(order.id);
            console.log(`  -> Entrega concluída:`, JSON.stringify(deliveryRes));

            reconciledPaid.push({
              orderId: order.id,
              customer: order.customer?.firstName,
              product: order.items?.[0]?.product?.title,
              total: order.total,
              endToEndId: tx.end_to_end_id,
              delivery: deliveryRes
            });
          }
        } else if (order.pixExpiresAt && new Date(order.pixExpiresAt) < new Date()) {
          console.log(`  -> Cobrança não foi paga na PushinPay e já expirou (venceu em ${order.pixExpiresAt}). Marcando como cancelled.`);
          await db.update(orders)
            .set({
              status: 'cancelled',
              updatedAt: new Date()
            })
            .where(and(
              eq(orders.id, order.id),
              eq(orders.status, 'pending')
            ));
          markedExpired.push(order.id);
        }
      } catch (err: any) {
        console.error(`  -> Erro ao verificar pedido ${order.id}:`, err.message);
      }
    } else if (order.paymentMethod === 'syncpay' && order.pixExpiresAt && new Date(order.pixExpiresAt) < new Date()) {
      console.log(`  -> Cobrança antiga SyncPay expirada em ${order.pixExpiresAt}. Marcando como cancelled.`);
      await db.update(orders)
        .set({
          status: 'cancelled',
          updatedAt: new Date()
        })
        .where(and(
          eq(orders.id, order.id),
          eq(orders.status, 'pending')
        ));
      markedExpired.push(order.id);
    }
  }

  console.log("\n=== RESUMO DA RECONCILIAÇÃO ===");
  console.log(`Total de pagamentos legitimamente confirmados e entregues: ${reconciledPaid.length}`);
  console.log(JSON.stringify(reconciledPaid, null, 2));
  console.log(`Total de pedidos expirados não-pagos cancelados: ${markedExpired.length}`);
}

reconcile().catch(console.error);
