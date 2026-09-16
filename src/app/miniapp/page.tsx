export default function MiniAppPage() {
  return (
    <div className="flex flex-col min-h-screen pb-16">
      <header className="px-4 py-3 border-b sticky top-0 bg-background/80 backdrop-blur z-10">
        <h1 className="text-xl font-bold">Minha Loja</h1>
      </header>
      
      <main className="flex-1 p-4 space-y-6">
        <section>
          <h2 className="text-lg font-semibold mb-3">Destaques</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Produto Placeholder */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="bg-muted aspect-square rounded-md w-full"></div>
              <h3 className="text-sm font-medium leading-none">Produto Exemplo</h3>
              <p className="text-sm font-bold text-primary">R$ 99,90</p>
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <div className="bg-muted aspect-square rounded-md w-full"></div>
              <h3 className="text-sm font-medium leading-none">Produto Exemplo 2</h3>
              <p className="text-sm font-bold text-primary">R$ 149,90</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 w-full max-w-md bg-background border-t p-3 flex justify-around items-center text-xs text-muted-foreground">
        <div className="flex flex-col items-center gap-1 text-primary">
          <span>Início</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span>Busca</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span>Carrinho</span>
        </div>
      </footer>
    </div>
  );
}
