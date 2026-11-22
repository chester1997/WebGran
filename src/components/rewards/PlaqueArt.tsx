import type { Plaque } from "@/lib/rewards/plaques";

/**
 * Arte da placa. Usa a arte em uso (troca do admin) ou a oficial padrão;
 * sem arte, desenha a placa em código na cor do nível.
 * - locked: escurece e tira a cor (placa ainda não conquistada)
 * - sheen: faixa de brilho que atravessa a placa de tempos em tempos
 */
export function PlaqueArt({
  plaque,
  src,
  locked = false,
  sheen = false,
  className = "",
}: {
  plaque: Plaque;
  /** Arte em uso (troca do admin). Sem ela, usa a arte padrão da placa. */
  src?: string | null;
  locked?: boolean;
  sheen?: boolean;
  className?: string;
}) {
  const { theme } = plaque;
  const art = src === undefined ? plaque.art : src;
  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-[14px] ring-1 ring-white/[0.06] transition-[filter] duration-500 ${
        locked ? "grayscale brightness-[0.42] contrast-[1.05]" : ""
      } ${className}`}
      style={{ background: `radial-gradient(120% 80% at 50% 20%, rgba(${theme.rgb},0.22) 0%, #0b0c10 70%)` }}
    >
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art}
          alt={`Placa ${plaque.short} — nível ${plaque.level}`}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div
          className="absolute inset-[7%] rounded-lg border flex flex-col items-center justify-between py-[10%]"
          style={{ borderColor: `rgba(${theme.rgb},0.55)`, background: "linear-gradient(180deg, #16171c 0%, #0d0e12 100%)" }}
        >
          <span className="text-[9px] font-bold tracking-[0.3em] text-zinc-400">WEBGRAN</span>
          <p
            className="text-[clamp(18px,3vw,30px)] font-black leading-none tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(180deg, ${theme.light} 0%, ${theme.main} 100%)` }}
          >
            {plaque.short}
          </p>
          <p className="text-[7.5px] font-semibold tracking-[0.25em] text-zinc-500">EM VENDAS</p>
        </div>
      )}

      {/* reflexo de vidro no topo */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 35%)" }}
      />

      {sheen && !locked && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
          <span
            className="absolute inset-y-[-20%] left-0 w-[45%] animate-[plaque-sheen_5.5s_ease-in-out_infinite]"
            style={{ background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0) 100%)" }}
          />
        </span>
      )}
    </div>
  );
}
