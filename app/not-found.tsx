import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-[1260px] flex-col items-center px-4 py-20 text-center">
      <p className="text-6xl font-bold text-[#c2185b]">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-[#6c757d]">The page you are looking for does not exist or has moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex h-11 items-center rounded-md bg-[#c2185b] px-6 text-sm font-semibold uppercase text-white hover:bg-[#ad1457]">
          Go home
        </Link>
        <Link href="/shop" className="inline-flex h-11 items-center rounded-md border border-[#dee2e6] px-6 text-sm font-medium hover:border-[#c2185b] hover:text-[#c2185b]">
          Browse the shop
        </Link>
      </div>
    </section>
  );
}
