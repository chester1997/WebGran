/**
 * Esqueleto exibido na hora em que o vendedor troca de página no painel,
 * enquanto o servidor prepara os dados. Só visual: não busca nada.
 */
export default function SellerLoading() {
  return (
    <div role="status" aria-label="Carregando" className="w-full space-y-6 animate-pulse">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-5 w-44 rounded-md bg-white/[0.06]" />
          <div className="h-3 w-72 max-w-[70vw] rounded bg-white/[0.04]" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-white/[0.06] hidden sm:block" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
        ))}
      </div>

      <div className="h-11 rounded-xl border border-white/[0.06] bg-white/[0.03]" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
