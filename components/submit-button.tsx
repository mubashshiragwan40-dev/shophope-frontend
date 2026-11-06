// components/submit-button.tsx
"use client";

import { type ButtonHTMLAttributes } from "react";

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean;
  label: string;
  loadingLabel?: string;
}

export default function SubmitButton({
  loading,
  label,
  loadingLabel = "Saving…",
  disabled,
  ...rest
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="inline-flex items-center justify-center rounded-md bg-[#e91e63] px-6 py-2.5 text-[14px] font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#c2185b] focus:outline-none focus:ring-2 focus:ring-[#e91e63] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      {...rest}
    >
      {loading && (
        <svg
          className="-ml-1 mr-2 h-4 w-4 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {loading ? loadingLabel : label}
    </button>
  );
}
