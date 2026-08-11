import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hecty",
    short_name: "Hecty",
    description: "Controle financeiro pessoal: importação, classificação e análise de receitas, despesas e investimentos.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf8",
    theme_color: "#0b1d3a",
    icons: [
      { src: "/brand/hecty-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/hecty-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
