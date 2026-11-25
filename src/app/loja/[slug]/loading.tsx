/** Aparece na hora ao trocar de página na loja (o menu continua no lugar), até a página chegar. */
const SHIMMER =
  "bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.035)_100%)] bg-[length:200%_100%] animate-[wg-shimmer_1.4s_linear_infinite]";

export default function LojaLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="pt-20 sm:pt-24 px-4 sm:px-8 lg:px-10 animate-[wg-fade_.2s_ease-out]">
      <div className={`h-7 w-56 rounded-[6px] ${SHIMMER}`} />
      <div className={`mt-3 h-4 w-80 max-w-full rounded-[6px] ${SHIMMER}`} />
      {[0, 1].map((r) => (
        <div key={r} className="mt-10">
          <div className={`h-5 w-40 rounded-[6px] ${SHIMMER}`} />
          <div className="mt-4 flex gap-2.5 overflow-hidden">
            {Array.from({ length: 8 }, (_, k) => (
              <div key={k} className={`shrink-0 w-[118px] sm:w-[160px] lg:w-[176px] aspect-[2/3] rounded-[6px] ${SHIMMER}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
