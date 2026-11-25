import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Lock } from "lucide-react";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getWebCustomer, getWebStore } from "@/lib/webstore/web-store";
import { ProductVideoService } from "@/lib/videos/product-video-service";
import { hasVipFor } from "@/lib/webstore/account";
import { BTN_PRIMARY, CARD } from "../../../_components/ui";
import { VideoArea } from "./VideoArea";

export default async function ProdutoAcessoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; productId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { slug, productId } = await params;
  const { v: startVideo } = await searchParams;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const customer = await getWebCustomer(store.id);
  if (!customer) redirect(`/loja/${slug}/entrar`);
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();
  const product = await db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.storeId, store.id)) });
  if (!product) notFound();

  let videos: Awaited<ReturnType<typeof ProductVideoService.listCustomerProductVideos>> = [];
  let denied: string | null = null;
  try {
    const vip = await hasVipFor(store.id, customer.shadowCustomerId, product.id);
    videos = await ProductVideoService.listCustomerProductVideos(store.id, customer.shadowCustomerId, product.id, { accessGranted: vip });
  } catch (e) {
    denied = (e as Error).message || "Você não tem acesso a este produto.";
  }

  return (
    <div className="w-full max-w-[1500px] px-4 sm:px-8 lg:px-10 pt-6 sm:pt-10">
      <Link href={`/loja/${slug}/conta`} className="inline-flex items-center gap-1.5 text-[13px] text-zinc-400 hover:text-white mb-5">
        <ArrowLeft className="w-4 h-4" /> Meus produtos
      </Link>
      <h1 className="text-[24px] sm:text-[28px] font-semibold tracking-tight mb-6">{product.title}</h1>
      {denied ? (
        <div className={`${CARD} py-14 px-6 text-center`}>
          <Lock className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-[14px] text-zinc-400">{denied}</p>
          <Link href={`/loja/${slug}/produto/${product.slug}`} className={`${BTN_PRIMARY} mt-5`}>
            Ver produto
          </Link>
        </div>
      ) : videos.length === 0 ? (
        <div className={`${CARD} py-14 px-6 text-center text-[14px] text-zinc-500`}>Os vídeos deste produto ainda estão sendo preparados pela loja.</div>
      ) : (
        <VideoArea
          slug={slug}
          productId={product.id}
          startVideo={typeof startVideo === "string" ? startVideo : null}
          videos={videos.map((v) => ({
            id: v.id,
            title: v.title,
            description: v.description,
            durationSeconds: v.durationSeconds,
            thumbnailUrl: v.thumbnailUrl,
            percent: v.progress ? Number(v.progress.progressPercent) || 0 : 0,
            completed: Boolean(v.progress?.completed),
          }))}
        />
      )}
    </div>
  );
}
