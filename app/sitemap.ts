import { and, eq } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { siteOrigin } from "@/lib/recebi/origin";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const pages: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${origin}/recebi`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${origin}/recebi/calculadora`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${origin}/recebi/cadastro`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${origin}/recebi/termos`, changeFrequency: "yearly", priority: 0.2 },
  ];
  try {
    // Páginas públicas dos freelancers que decidiram publicar.
    const profiles = await getDb()
      .select({ slug: users.slug })
      .from(users)
      .where(and(eq(users.publicProfile, true), eq(users.isDemo, false)))
      .limit(5000);
    for (const { slug } of profiles) if (slug) pages.push({ url: `${origin}/recebi/p/${slug}`, changeFrequency: "weekly", priority: 0.6 });
  } catch {
    // Sem banco disponível (ex.: durante o build): só as páginas fixas.
  }
  return pages;
}
