// components/site-footer.tsx
import Link from "next/link";
import type { ReactNode } from "react";

const LOGO_SRC: string = "/logo.png";
const LEGAL_BUSINESS_NAME: string = "شركة مكافاه لبيع بالتجزئة للهدايا والكماليات";

export default function SiteFooter(): ReactNode {
  return (
    <footer className="bg-[#212529] text-white">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-11 grid gap-6 sm:gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_SRC}
            alt="Shop & Hope"
            className="h-14 w-auto max-w-[170px] object-contain bg-white p-1 rounded-md"
          />
          <p className="mt-2.5 text-xs sm:text-sm text-white/65 leading-relaxed">
            Best Deal Here. Fashion, beauty, electronics and more for the whole family across Kuwait.
          </p>
          <p className="mt-1.5 text-xs text-white/75 leading-relaxed" dir="rtl">
            {LEGAL_BUSINESS_NAME}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] mb-3">Quick Link</h3>
          <ul className="space-y-1.5 text-xs sm:text-sm text-white/75">
            <li>
              <Link href="/refund-policy" className="hover:text-[#e91e63] transition-colors">
                Refund and Returns Policy
              </Link>
            </li>
            <li>
              <Link href="/privacy-policy" className="hover:text-[#e91e63] transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-[#e91e63] transition-colors">
                Orders Tracking
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] mb-3">Social Media</h3>
          <ul className="space-y-1.5 text-xs sm:text-sm text-white/75">
            <li>
              <a href="#" className="hover:text-[#e91e63] transition-colors">
                Facebook
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-[#e91e63] transition-colors">
                Instagram
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-[#e91e63] transition-colors">
                TikTok
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] mb-3">Contact Info</h3>
          <ul className="space-y-1.5 text-xs sm:text-sm text-white/75">
            <li>Mubarak Al-Kabeer, Kuwait</li>
            <li>
              Phone / WhatsApp:{" "}
              <a
                href="https://wa.me/96599429456"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#e91e63] transition-colors"
              >
                +965 99429456
              </a>
            </li>
            <li>
              Mail:{" "}
              <a
                href="mailto:customercare@shophope.online"
                className="hover:text-[#e91e63] transition-colors"
              >
                customercare@shophope.online
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-20 md:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-white/55">
          <p>© 2026 Shop &amp; Hope – All rights reserved.</p>
          <p dir="rtl" className="text-white/70">
            {LEGAL_BUSINESS_NAME}
          </p>
        </div>
      </div>
    </footer>
  );
}