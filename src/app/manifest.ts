import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WebGran",
    short_name: "WebGran",
    description: "plataforma WebGran",
    id: "/",
    // Escopo só do painel: o app WebGran não pode "ser dono" das lojas (/loja/...), que têm app próprio.
    // O id continua "/" para quem já instalou receber a atualização em vez de um app novo.
    start_url: "/seller",
    scope: "/seller",
    display: "standalone",
    background_color: "#121214",
    theme_color: "#121214",
    orientation: "portrait-primary",
    lang: "pt-BR",
    categories: ["business", "finance", "shopping", "utilities"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
