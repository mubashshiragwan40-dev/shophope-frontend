// components/meta-pixel.tsx
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

export const META_PIXEL_ID: string =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "1697119197563195";

type MetaPrimitive = string | number | boolean;
export type MetaEventParams = Record<
  string,
  MetaPrimitive | Array<string | number> | undefined
>;

declare global {
  interface Window {
    fbq?: (
      command: "init" | "track" | "trackCustom",
      eventNameOrId: string,
      params?: MetaEventParams
    ) => void;
    _fbq?: unknown;
  }
}

export function trackMetaEvent(eventName: string, params?: MetaEventParams): void {
  if (typeof window === "undefined") return;
  if (!META_PIXEL_ID || typeof window.fbq !== "function") return;
  if (params) {
    window.fbq("track", eventName, params);
  } else {
    window.fbq("track", eventName);
  }
}

export default function MetaPixel(): ReactNode {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    trackMetaEvent("PageView");
  }, [pathname, searchParams]);

  if (!META_PIXEL_ID) return null;

  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}