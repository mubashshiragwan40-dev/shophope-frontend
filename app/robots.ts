// app/robots.ts
import type { MetadataRoute } from "next";

const SITE_URL: string = "https://shophope.online";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/checkout",
          "/cart",
          "/my-account",
          "/my-account/",
          "/order-confirmation",
          "/wishlist",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}