import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.shophope.online";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/shop", "/product/"],
        disallow: ["/cart", "/checkout", "/my-account", "/orders", "/wishlist", "/order-confirmation", "/api/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}