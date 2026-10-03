import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/recebi/origin";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Painel, links de cobrança/orçamento e APIs não devem aparecer em buscadores.
        disallow: ["/recebi/painel", "/recebi/api/", "/recebi/c/", "/recebi/o/", "/recebi/redefinir-senha/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
