// app/category/[slug]/page.tsx
import { redirect } from "next/navigation";

export default async function CategoryRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/shop?category=${encodeURIComponent(slug)}`);
}