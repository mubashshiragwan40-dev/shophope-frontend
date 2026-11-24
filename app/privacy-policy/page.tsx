// app/privacy-policy/page.tsx
import Link from "next/link";
import type { ReactNode } from "react";

const LEGAL_BUSINESS_NAME: string = "شركة مكافاه لبيع بالتجزئة للهدايا والكماليات";

export default function PrivacyPolicyPage(): ReactNode {
  return (
    <>
      <section className="bg-[#f8f9fa] border-b border-[#f1f5f9]">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#212529]">Privacy Policy</h1>
          <nav aria-label="Breadcrumb" className="mt-3 text-sm text-[#6c757d]">
            <Link href="/" className="hover:text-[#e91e63] transition-colors">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span className="text-[#212529]">Privacy Policy</span>
          </nav>
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 space-y-5 text-[15px] leading-relaxed text-[#495057]">
          <p>
            <strong>Shop &amp; Hope</strong> (operated under legal entity{" "}
            <span dir="rtl" className="font-semibold text-[#212529]">
              {LEGAL_BUSINESS_NAME}
            </span>
            ) respects your privacy and protects your personal information when you browse or place orders on{" "}
            <strong>shophope.online</strong>.
          </p>
          <h2 className="text-lg font-bold text-[#212529]">Information We Collect</h2>
          <p>
            We collect your name, Kuwait WhatsApp mobile number, delivery address (Governorate, Area, Block, Street,
            Building), and optional email solely to fulfill and deliver your orders across Kuwait.
          </p>
          <h2 className="text-lg font-bold text-[#212529]">Contact Us</h2>
          <p>
            For any privacy questions, contact us at{" "}
            <a href="mailto:customercare@shophope.online" className="text-[#e91e63] underline">
              customercare@shophope.online
            </a>{" "}
            or WhatsApp <strong>+965 99429456</strong>.
          </p>
        </div>
      </section>
    </>
  );
}