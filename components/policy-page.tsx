import type { ReactNode } from "react";

export default function PolicyPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-[800px] px-4 py-10 sm:px-6 lg:px-0">
      <h1 className="text-[28px] font-semibold sm:text-[32px]">{title}</h1>
      <p className="mt-1 text-sm text-[#6c757d]">Last updated: {updated}</p>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-[#212529] [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
