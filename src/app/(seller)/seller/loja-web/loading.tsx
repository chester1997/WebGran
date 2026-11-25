/** Aparece na hora ao abrir a Loja Web no painel, até os dados chegarem. */
const SHIMMER =
  "bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.07)_50%,rgba(255,255,255,0.03)_100%)] bg-[length:200%_100%] animate-[wg-shimmer_1.4s_linear_infinite]";

export default function LojaWebLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="w-full pb-10 space-y-5 animate-[wg-fade_.2s_ease-out]">
      <div className="pt-2 sm:pt-4 space-y-3">
        <div className={`h-7 w-40 rounded-[8px] ${SHIMMER}`} />
        <div className={`h-4 w-96 max-w-full rounded-[6px] ${SHIMMER}`} />
        <div className="flex gap-2 pt-2">
          {Array.from({ length: 6 }, (_, k) => (
            <div key={k} className={`h-9 w-28 rounded-[10px] ${SHIMMER}`} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, k) => (
          <div key={k} className={`h-20 rounded-[14px] ${SHIMMER}`} />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 6 }, (_, k) => (
          <div key={k} className={`h-28 rounded-[14px] ${SHIMMER}`} />
        ))}
      </div>
    </div>
  );
}
