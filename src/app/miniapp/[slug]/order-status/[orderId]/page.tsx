import { db } from "@/db";
import { orders, stores } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, ShieldCheck, ShoppingBag } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function OrderStatusPage({
  params
}: {
  params: Promise<{ slug: string; orderId: string }>
}) {
  const { slug, orderId } = await params;

  const store = await db.query.stores.findFirst({
    where: eq(stores.slug, slug),
  });

  if (!store) notFound();

  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, orderId),
      eq(orders.storeId, store.id)
    ),
    with: {
      items: {
        with: {
          product: true
        }
      }
    }
  });

  if (!order) notFound();

  const isPaid = order.status === 'paid';
  const isPending = order.status === 'pending';
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-[#161616] text-white p-4 pt-8 pb-24 flex flex-col items-center justify-center max-w-lg mx-auto space-y-6">
      {/* Icon and Status Badge */}
      <div className="text-center space-y-3">
        {isPaid && (
          <>
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-white">Pagamento Confirmado!</h1>
            <p className="text-sm text-zinc-400">
              Seu pedido foi pago com sucesso. Seu acesso já foi liberado.
            </p>
          </>
        )}

        {isPending && (
          <>
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/20">
              <Clock className="w-10 h-10 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-white">Aguardando Pagamento</h1>
            <p className="text-sm text-zinc-400">
              Estamos aguardando a confirmação do Mercado Pago. Assim que for compensado, seu acesso será liberado automaticamente.
            </p>
          </>
        )}

        {isCancelled && (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400 shadow-lg shadow-red-500/20">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-white">Pagamento Não Concluído</h1>
            <p className="text-sm text-zinc-400">
              O pedido foi cancelado ou recusado pelo Mercado Pago.
            </p>
          </>
        )}
      </div>

      {/* Order Info Card */}
      <div className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs text-zinc-400">
          <span>Pedido #{order.id.slice(0, 8)}</span>
          <span className="font-mono text-zinc-300">
            {order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : ''}
          </span>
        </div>

        {/* Items List */}
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                {item.product?.coverUrl ? (
                  <img src={item.product.coverUrl} alt={item.product.title} className="w-10 h-10 object-cover rounded-lg" />
                ) : (
                  <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-zinc-500" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-zinc-100">{item.product?.title || 'Produto'}</div>
                  <div className="text-xs text-zinc-500">Qtd: {item.quantity}</div>
                </div>
              </div>
              <span className="font-medium text-emerald-400">
                R$ {Number(item.total).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-zinc-800 flex justify-between items-center text-base font-bold">
          <span className="text-zinc-300">Total Pago</span>
          <span className="text-emerald-400">R$ {Number(order.total).toFixed(2)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full space-y-3 pt-2">
        {isPaid ? (
          <Link
            href={`/miniapp/${slug}/accesses`}
            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all text-sm"
          >
            <ShieldCheck className="w-5 h-5" />
            Acessar Meus Conteúdos
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <Link
            href={`/miniapp/${slug}`}
            className="w-full py-4 px-6 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
          >
            Voltar para a Loja
          </Link>
        )}
      </div>
    </div>
  );
}
