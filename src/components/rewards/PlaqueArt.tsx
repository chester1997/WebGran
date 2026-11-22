import { Lock } from "lucide-react";
import type { Plaque } from "@/lib/rewards/plaques";

/**
 * Arte da placa. Usa a arte oficial quando existir (plaque.art);
 * até lá, desenha a placa em código na cor do nível.
 */
export function PlaqueArt({ plaque, locked = false, className = "" }: { plaque: Plaque; locked?: boolean; className?: string }) {
  const { theme } = plaque;
  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-xl ${locked ? "grayscale opacity-45" : ""} ${className}`}
      style={{
        background: `radial-gradient(120% 80% at 50% 20%, rgba(${theme.rgb},0.22) 0%, #0b0c10 70%)`,
        boxShadow: locked ? undefined : `0 18px 40px -18px rgba(${theme.rgb},0.6)`,
      }}
    >
      {plaque.art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={plaque.art} alt={`Placa ${plaque.short} — nível ${plaque.level}`} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div
          className="absolute inset-[7%] rounded-lg border flex flex-col items-center justify-between py-[10%]"
          style={{ borderColor: `rgba(${theme.rgb},0.55)`, background: "linear-gradient(180deg, #16171c 0%, #0d0e12 100%)" }}
        >
          <span className="text-[9px] font-bold tracking-[0.3em] text-zinc-400">WEBGRAN</span>
          <svg viewBox="0 0 64 40" className="w-[55%]" aria-hidden="true">
            <defs>
              <linearGradient id={`pl-${plaque.value}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={theme.light} />
                <stop offset="0.55" stopColor={theme.main} />
                <stop offset="1" stopColor={theme.light} />
              </linearGradient>
            </defs>
            <path
              d="M6 30 L18 10 L30 26 L42 10 L58 30"
              fill="none"
              stroke={`url(#pl-${plaque.value})`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-center">
            <p
              className="text-[clamp(18px,3vw,30px)] font-black leading-none tracking-tight bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(180deg, ${theme.light} 0%, ${theme.main} 100%)` }}
            >
              {plaque.short}
            </p>
            <p className="mt-1 text-[7.5px] font-semibold tracking-[0.25em] text-zinc-500">DE FATURAMENTO</p>
          </div>
        </div>
      )}
      {locked && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-9 h-9 rounded-full bg-black/60 border border-white/15 flex items-center justify-center">
            <Lock className="w-4 h-4 text-zinc-300" />
          </span>
        </span>
      )}
    </div>
  );
}
