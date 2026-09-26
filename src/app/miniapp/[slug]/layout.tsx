import { ReactNode, Suspense } from "react";
import { MiniAppProviders } from "../Providers";
import { ThemeEngineLayout } from "@/components/themes/engine";

export default async function MiniAppLayout({ 
  children, 
  params 
}: { 
  children: ReactNode, 
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = await params;
  return (
    <MiniAppProviders storeSlug={resolvedParams.slug}>
      <ThemeEngineLayout storeSlug={resolvedParams.slug}>
        <Suspense fallback={<div className="p-4 text-center text-zinc-400 animate-pulse">Carregando...</div>}>
          {children}
        </Suspense>
      </ThemeEngineLayout>
    </MiniAppProviders>
  );
}
