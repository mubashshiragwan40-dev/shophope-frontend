// app/refund-policy/page.tsx
import Link from "next/link";
import type { ReactNode } from "react";

export default function RefundPolicyPage(): ReactNode {
  return (
    <>
      <section className="bg-[#f8f9fa] border-b border-[#f1f5f9]">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#212529]">Refund &amp; Returns Policy</h1>
          <nav aria-label="Breadcrumb" className="mt-3 text-sm text-[#6c757d]">
            <Link href="/" className="hover:text-[#e91e63] transition-colors">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-[#212529]">Refund &amp; Returns Policy</span>
          </nav>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 space-y-5 text-[15px] leading-relaxed text-[#495057]">
          <p>
            At <strong>Shop &amp; Hope</strong>, customer satisfaction across Kuwait is our top priority. If you are not
            satisfied with your purchase, you may request a return or exchange within <strong>7 days</strong> of delivery.
          </p>
          <h2 className="text-lg font-bold text-[#212529]">Eligibility for Returns</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Items must be unused, unwashed, and in original packaging with all tags attached.</li>
            <li>For hygiene reasons, innerwear, lingerie, and opened beauty products cannot be returned unless damaged.</li>
            <li>Please share your Order Number via WhatsApp (+965 99429456) to arrange pickup in Kuwait.</li>
          </ul>
          <h2 className="text-lg font-bold text-[#212529]">Refund Process</h2>
          <p>
            Once our team inspects the returned item, refunds for Cash on Delivery (COD) orders are processed via bank
            transfer / KNET link or store credit within 3–5 working days in KWD.
          </p>
        </div>
      </section>
    </>
  );
}