// components/protected-product-image.tsx
"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

interface ProtectedProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  showWatermark?: boolean;
  watermarkText?: string;
}

export default function ProtectedProductImage({
  src,
  alt,
  className = "",
  imgClassName = "w-full h-full object-cover",
  loading = "lazy",
  showWatermark = true,
  watermarkText = "SHOP & HOPE",
}: ProtectedProductImageProps): ReactNode {
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const showImage: boolean = Boolean(src) && !imgFailed;

  const blockContextMenu = (e: MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
  };

  return (
    <div
      onContextMenu={blockContextMenu}
      onDragStart={(e) => e.preventDefault()}
      className={`protected-product-media relative w-full h-full overflow-hidden select-none ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={alt}
          loading={loading}
          draggable={false}
          onError={() => setImgFailed(true)}
          className={imgClassName}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <svg
            viewBox="0 0 200 150"
            className="max-h-[140px] w-auto"
            role="img"
            aria-label="Product image placeholder"
          >
            <rect x="62" y="40" width="76" height="76" rx="14" fill="#ffffff" stroke="#212529" strokeWidth="5" />
            <rect x="76" y="22" width="48" height="20" rx="6" fill="#e91e63" />
            <circle cx="100" cy="80" r="16" fill="#fde4ec" />
          </svg>
        </div>
      )}

      {/* Subtle Shein-style brand watermark */}
      {showImage && showWatermark && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-2.5"
        >
          <div className="flex-1 flex items-center justify-center">
            <span className="-rotate-12 text-[11px] sm:text-[15px] font-extrabold tracking-[0.2em] text-white/35 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] uppercase">
              {watermarkText}
            </span>
          </div>
          <div className="flex justify-end">
            <span className="rounded bg-black/25 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-white/80 uppercase backdrop-blur-[1px]">
              {watermarkText}
            </span>
          </div>
        </div>
      )}

      {/* Transparent shield layer so right-click / long-press hits this div instead of <img> */}
      <div aria-hidden="true" className="absolute inset-0 z-[5] bg-transparent" />
    </div>
  );
}