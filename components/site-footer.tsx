// components/site-footer.tsx
import Link from "next/link";
import type { ReactNode } from "react";

const LOGO_SRC: string = "/logo.png";

export default function SiteFooter(): ReactNode {
  return (
    <footer className="bg-[#212529] text-white">
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="Shop & Hope" className="h-[64px] w-auto max-w-[180px] object-contain bg-white p-1 rounded" />
          <p className="mt-3 text-sm text-white/60 leading-relaxed">
            Best Deal Here. Fashion, beauty, electronics and more for the whole family.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4">Quick Link</h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li>
              <Link href="/refund-policy" className="hover:text-[#e91e63] transition-colors">Refund and Returns Policy</Link>
            </li>
            <li>
              <Link href="/privacy-policy" className="hover:text-[#e91e63] transition-colors">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-[#e91e63] transition-colors">Orders Tracking</Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4">Social Media</h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li><a href="#" className="hover:text-[#e91e63] transition-colors">Facebook</a></li>
            <li><a href="#" className="hover:text-[#e91e63] transition-colors">Instagram</a></li>
            <li><a href="#" className="hover:text-[#e91e63] transition-colors">TikTok</a></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4">Contact Info</h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li>Mubarak Al-Kabeer, Kuwait</li>
            <li>
              Phone:{" "}
              <a href="tel:+96599429456" className="hover:text-[#e91e63] transition-colors">+96599429456</a>
            </li>
            <li>
              Mail:{" "}
              <a href="mailto:customercare@shophope.in" className="hover:text-[#e91e63] transition-colors">customercare@shophope.in</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-5 text-xs text-white/50">
          © 2025 Shop Hope – All rights reserved.
        </p>
      </div>
    </footer>
  );
}
