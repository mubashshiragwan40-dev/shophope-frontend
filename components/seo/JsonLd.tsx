import React from "react";

interface ProductSchemaProps {
  name: string;
  description: string;
  image: string;
  priceKwd: number;
  inStock: boolean;
  url: string;
}

export function ProductJsonLd({
  name,
  description,
  image,
  priceKwd,
  inStock,
  url,
}: ProductSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image: [image],
    brand: {
      "@type": "Brand",
      name: "Shop and Hop",
    },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "KWD",
      price: priceKwd.toFixed(3),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      areaServed: {
        "@type": "Country",
        name: "Kuwait",
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}