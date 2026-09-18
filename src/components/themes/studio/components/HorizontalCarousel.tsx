import React, { ReactNode } from "react";

interface HorizontalCarouselProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function HorizontalCarousel({
  title,
  subtitle,
  children,
  className = "",
}: HorizontalCarouselProps) {
  return (
    <section className={`py-2 w-full overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-[var(--miniapp-content-padding-x)] mb-3">
          {typeof title === "string" ? (
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 bg-violet-600 rounded-full shrink-0"></div>
              <h2 className="text-white text-base font-bold tracking-tight uppercase flex items-center gap-2">
                {title}
                {subtitle && (
                  <span className="text-zinc-600 text-[10px] lowercase font-normal">
                    {subtitle}
                  </span>
                )}
              </h2>
            </div>
          ) : (
            title
          )}
        </div>
      )}

      {/* Carousel Track Container:
          Utiliza padding-inline-start e padding-inline-end com var(--miniapp-content-padding-x).
          Garante que o PRIMEIRO card comece exatamente alinhado com o título (x = var(--miniapp-content-padding-x))
          e o ÚLTIMO card possua margem final visível ao scrollar completamente sem quebrar o layout ou a viewport.
      */}
      <div 
        className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 w-full"
        style={{
          paddingInlineStart: "var(--miniapp-content-padding-x)",
          paddingInlineEnd: "var(--miniapp-content-padding-x)",
          gap: "var(--carousel-gap)",
        }}
      >
        {children}
      </div>
    </section>
  );
}
