import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.shophope.online";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  // Replace or extend with live product slugs from WPGraphQL/WooCommerce
  const sampleSlugs = ["sample-product"];
  const productRoutes: MetadataRoute.Sitemap = sampleSlugs.map((slug) => ({
    url: `${baseUrl}/product/${slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}