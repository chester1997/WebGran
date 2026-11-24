import Link from "next/link";
import { notFound } from "next/navigation";
import { getWebStore } from "@/lib/webstore/web-store";
import { readResetToken } from "@/lib/webstore/profile";
import { BTN_PRIMARY, CARD } from "../_components/ui";
import { NewPasswordForm } from "./NewPasswordForm";

export default async function NovaSenhaPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ t?: string }> }) {
  const { slug } = await params;
  const { t } = await searchParams;
  const store = await getWebStore(slug);
  if (!store) notFound();
  const token = typeof t === "string" ? t : "";
  const customer = token ? await readResetToken(store.id, token) : null;
  if (!customer) {
    return (
      <div className="mx-auto max-w-[440px] px-4 py-10 sm:py-16">
        <div className={`${CARD} p-6 sm:p-7 text-center`}>
          <h1 className="text-[20px] font-semibold tracking-tight">Link vencido ou já usado</h1>
          <p className="mt-2 text-[14px] text-zinc-400">Peça um novo link para a loja. Cada link vale por 24 horas e só uma vez.</p>
          <Link href={`/loja/${slug}/recuperar`} className={`${BTN_PRIMARY} mt-6`}>
            Pedir novo link
          </Link>
        </div>
      </div>
    );
  }
  return <NewPasswordForm slug={slug} token={token} email={customer.email} />;
}
