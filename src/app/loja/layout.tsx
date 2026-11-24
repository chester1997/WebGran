import { Suspense, type ReactNode } from "react";

/** Loja Web: páginas dinâmicas (sessão do cliente por cookie), dentro de Suspense. */
export default function LojaRootLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#09090b]" />}>
      {children}
    </Suspense>
  );
}
