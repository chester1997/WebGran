import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Play } from "lucide-react";
import { getWebCustomer, getWebStore } from "@/lib/webstore/web-store";
import { loadWebProduct } from "@/lib/webstore/catalog";
import { hasActiveAccess } from "@/lib/webstore/account";
import { listWebProducts } from "@/lib/webstore/products";
import { ProductVideoService } from "@/lib/videos/product-video-service";
import { brl, DURATION_LABEL } from "../../_components/ui";
import { ProductBuy } from "../../_components/ProductBuy";

import { thumb } from "@/lib/webstore/img";
const dur = (s: number) => (s > 0 ? `${Math.max(1, Math.round(s / 60))} min` : "");

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const product = await loadWebProduct(store.id, decodeURIComponent(productSlug));
  if (!product) notFound();
  const customer = await getWebCustomer(store.id);
  const [owned, videos, others] = await Promise.all([
    customer ? hasActiveAccess(store.id, customer.shadowCustomerId, product.id) : Promise.resolve(false),
    ProductVideoService.listProductVideos(store.id, product.id, true).catch(() => []),
    listWebProducts(store.id, { onlyActive: true }),
  ]);
  const totalMin = Math.round(videos.reduce((a, v) => a + (Number(v.durationSeconds) || 0), 0) / 60);
  const more = others.filter((p) => p.id !== product.id && p.videoCount > 0).slice(0, 12);
  const art = product.bannerUrl || product.coverUrl;

  return (
    <div>
      <section className="relative min-h-[520px] sm:min-h-[600px] flex items-end overflow-hidden">
        {art && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            // Fundo borrado (sem banner): uma miniatura pequena basta e deixa o desfoque bem mais leve
            src={product.bannerUrl ? thumb(art, 1600) : thumb(art, 240)}
            srcSet={product.bannerUrl ? `${thumb(art, 960)} 960w, ${thumb(art, 1600)} 1600w, ${thumb(art, 1920)} 1920w` : undefined}
            sizes={product.bannerUrl ? "100vw" : undefined}
            alt="" decoding="async" fetchPriority="high" className={`absolute inset-0 w-full h-full object-cover object-[center_25%] ${product.bannerUrl ? "" : "scale-125 blur-[30px] brightness-[0.5]"}`} />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#07080a_5%,rgba(7,8,10,0.75)_45%,rgba(7,8,10,0.1)),linear-gradient(0deg,#07080a_4%,rgba(7,8,10,0)_55%)]" />
        <div className="relative z-10 w-full px-4 sm:px-8 lg:px-10 pt-28 pb-10 grid md:grid-cols-[minmax(0,1fr)_260px] gap-8 items-end">
          <div className="max-w-[640px]">
            <h1 className="text-[32px] sm:text-[48px] font-black leading-[1] tracking-[-0.03em] [text-wrap:balance]">{product.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[13.5px] text-zinc-200">
              {videos.length > 0 && <span>{videos.length} {videos.length === 1 ? "vídeo" : "episódios"}</span>}
              {totalMin > 0 && <span className="text-zinc-400">· ~{totalMin >= 60 ? `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, "0")}` : `${totalMin} min`}</span>}
              <span className="h-[22px] px-2 rounded-[6px] border border-white/25 text-[11.5px] inline-flex items-center">{DURATION_LABEL[product.duration || "lifetime"] || "Vitalício"}</span>
            </div>
            {(product.shortDescription || product.description) && <p className="mt-4 text-[15px] leading-relaxed text-zinc-300 line-clamp-4 whitespace-pre-line">{product.shortDescription || product.description}</p>}
            {!owned && (
              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-[28px] font-black tabular-nums">{brl(product.price)}</span>
                {product.compareAtPrice && product.compareAtPrice > product.price && <span className="text-[15px] text-zinc-500 line-through">{brl(product.compareAtPrice)}</span>}
              </div>
            )}
            <div className="mt-4 max-w-[520px]">
              <ProductBuy slug={slug} productId={product.id} owned={owned} />
            </div>
          </div>
          {product.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb(product.coverUrl, 720)} alt={product.title} decoding="async" className="hidden md:block w-[260px] aspect-[2/3] object-cover rounded-[8px] ring-1 ring-white/10 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.95)]" />
          )}
        </div>
      </section>

      <div className="px-4 sm:px-8 lg:px-10 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-10">
        <section>
          <h2 className="flex items-baseline justify-between text-[20px] font-bold mb-3">
            Episódios
            <span className="text-[13px] font-medium text-zinc-500">{owned ? "Liberados para você" : "Liberados após o PIX"}</span>
          </h2>
          {videos.length === 0 ? (
            <p className="text-[14px] text-zinc-500 py-6">Os vídeos deste título estão sendo preparados.</p>
          ) : (
            <ol className="divide-y divide-white/[0.06]">
              {videos.map((v, i) => {
                const content = (
                  <>
                    <span className="w-7 text-center text-[20px] text-zinc-500 tabular-nums shrink-0">{i + 1}</span>
                    <span className="relative w-[118px] sm:w-[150px] aspect-video rounded-[9px] overflow-hidden bg-[#15161a] shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : product.coverUrl && <img src={product.coverUrl} alt="" className="w-full h-full object-cover opacity-60" />}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        {owned ? <Play className="w-6 h-6 fill-white" /> : <Lock className="w-5 h-5 text-white/85" />}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold truncate">{v.title}</span>
                      <span className="block text-[12.5px] text-zinc-500">{dur(Number(v.durationSeconds) || 0)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={v.id}>
                    {owned ? (
                      <Link href={`/loja/${slug}/conta/produto/${product.id}?v=${v.id}`} className="flex items-center gap-4 py-3 px-2 -mx-2 rounded-[6px] hover:bg-white/[0.04]">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-4 py-3 px-2 -mx-2">{content}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <aside className="text-[13.5px] text-zinc-400 leading-7 lg:pt-12">
          <p>
            <span className="text-zinc-200">Entrega:</span> vídeos aqui na loja
          </p>
          <p>
            <span className="text-zinc-200">Acesso:</span> {DURATION_LABEL[product.duration || "lifetime"] || "Vitalício"}
          </p>
          <p>
            <span className="text-zinc-200">Pagamento:</span> PIX, liberação automática
          </p>
          <p>
            <span className="text-zinc-200">Onde assistir:</span> celular ou computador, continua de onde parou
          </p>
          {product.description && product.shortDescription && <p className="mt-4 text-zinc-400 whitespace-pre-line">{product.description}</p>}
        </aside>
      </div>

      {more.length > 0 && (
        <section className="mt-12">
          <h2 className="px-4 sm:px-8 lg:px-10 text-[20px] font-bold mb-1">Mais títulos</h2>
          <div className="flex gap-2.5 overflow-x-auto px-4 sm:px-8 lg:px-10 pt-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {more.map((p) => (
              <Link key={p.id} href={`/loja/${slug}/produto/${p.slug}`} className="shrink-0 w-[118px] sm:w-[160px] aspect-[2/3] rounded-[6px] overflow-hidden bg-[#15161a] ring-1 ring-white/[0.06] hover:ring-2 hover:ring-[#3b82f6] transition-shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.coverUrl && <img src={thumb(p.coverUrl, 360)} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
