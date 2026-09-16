import { ReactNode } from "react";
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
        {children}
      </ThemeEngineLayout>
    </MiniAppProviders>
  );
}
