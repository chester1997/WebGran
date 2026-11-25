import type { SVGProps } from "react";

/** Ícones monocromáticos (herdam a cor do texto) das origens de lead. */
export function LeadSourceIcon({ source, size = 18, ...rest }: { source: string | null | undefined; size?: number } & SVGProps<SVGSVGElement>) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, ...rest };
  switch (source) {
    case "instagram":
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="18" height="18" rx="5.5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...p} fill="currentColor">
          <path d="M16.6 2.5c.3 2.3 1.8 3.9 4.2 4.1v3.4c-1.6 0-3-.5-4.2-1.3v6.6a6 6 0 1 1-5.9-6v3.5a2.6 2.6 0 1 0 2.5 2.6V2.5h3.4z" />
        </svg>
      );
    case "kwai":
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
          <rect x="2.5" y="6" width="13" height="12" rx="3" />
          <path d="M15.5 10.5 21 7.5v9l-5.5-3" />
          <circle cx="7" cy="3.8" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="11.4" cy="3.8" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...p} fill="currentColor">
          <path d="M13.6 21.5v-7.8h2.6l.4-3.1h-3V8.7c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H7.9v3.1h2.6v7.8h3.1z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...p} fill="currentColor">
          <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8c.2.9 1 1.6 1.9 1.9 1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM10 15.1V8.9l5.2 3.1L10 15.1z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
          <path d="M3.5 20.5l1.2-4.1A8.6 8.6 0 1 1 8 19.5l-4.5 1z" />
          <path d="M9.2 8.6c-.2 2.9 2.9 6.2 6 6l.9-1.3-1.9-1-.9.7a4.6 4.6 0 0 1-2.4-2.4l.7-.9-1-1.9-1.4.8z" fill="currentColor" strokeWidth={0.8} />
        </svg>
      );
    case "telegram":
      return (
        <svg {...p} fill="currentColor">
          <path d="M21.4 3.6 2.9 10.7c-1.1.4-1 1.9.1 2.2l4.5 1.4 1.7 5.4c.3.9 1.4 1.1 2 .4l2.5-2.4 4.6 3.4c.7.5 1.7.1 1.9-.8L23 5.1c.2-1.1-.6-1.9-1.6-1.5zM9.9 14.6l-.4 3.3-1.2-4 9.3-6.1-7.7 6.8z" />
        </svg>
      );
    case "google":
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="M20 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.5a4.6 4.6 0 1 1-1.3-5.2" />
        </svg>
      );
    case "indicacao":
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5" />
          <path d="M16.5 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.7 2.6 3 5.2" />
        </svg>
      );
    default:
      return (
        <svg {...p} fill="currentColor">
          <circle cx="5.5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="18.5" cy="12" r="2" />
        </svg>
      );
  }
}
