import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, PlayCircle, ShieldCheck } from "lucide-react";
import { getWebCustomer, getWebStore } from "@/lib/webstore/web-store";
import { loadWebProduct } from "@/lib/webstore/catalog";
import { hasActiveAccess } from "@/lib/webstore/account";
import { brl, DELIVERY_LABEL, DURATION_LABEL } from "../../_components/ui";
import { ProductBuy } from "../../_components/ProductBuy";

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const product = await loadWebProduct(store.id, decodeURIComponent(productSlug));
  if (!product) notFound();
  const customer = await getWebCustomer(store.id);
  const owned = customer ? await hasActiveAccess(store.id, customer.shadowCustomerId, product.id) : false;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-10">
      <Link href={`/loja/${slug}`} className="inline-flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-white mb-5">
        <ArrowLeft className="w-4 h-4" /> Voltar para a loja
      </Link>
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 md:gap-10">
        <div className="rounded-[20px] overflow-hidden border border-white/[0.07] bg-[#111113] aspect-[4/5] md:aspect-auto md:min-h-[460px]">
          {product.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.coverUrl} alt={product.title} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-[26px] sm:text-[32px] font-semibold tracking-tight leading-tight">{product.title}</h1>
            {product.shortDescription && <p className="mt-2 text-[15px] text-zinc-400">{product.shortDescription}</p>}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[30px] font-bold tabular-nums">{brl(product.price)}</span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-[15px] text-zinc-500 line-through">{brl(product.compareAtPrice)}</span>
            )}
          </div>
          <ul className="grid gap-2 text-[13.5px] text-zinc-300">
            <li className="flex items-center gap-2.5">
              <PlayCircle className="w-[18px] h-[18px] text-[#7fb0ff]" /> {DELIVERY_LABEL[product.deliveryType] || "Acesso digital"}
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="w-[18px] h-[18px] text-[#7fb0ff]" /> Acesso: {DURATION_LABEL[product.duration || "lifetime"] || "Vitalício"}
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="w-[18px] h-[18px] text-[#7fb0ff]" /> Liberação automática após o PIX
            </li>
          </ul>
          <ProductBuy slug={slug} productId={product.id} owned={owned} />
          {product.description && (
            <div className="pt-5 border-t border-white/[0.06]">
              <h2 className="text-[14px] font-semibold mb-2">Descrição</h2>
              <p className="text-[14px] leading-relaxed text-zinc-400 whitespace-pre-line">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
