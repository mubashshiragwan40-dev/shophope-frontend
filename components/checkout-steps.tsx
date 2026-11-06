import type { ReactElement } from "react";

export const CHECKOUT_STEPS: string[] = ["Shopping Cart", "Checkout", "Order Complete"];

interface CheckoutStepsProps {
  current: number;
}

export default function CheckoutSteps({ current }: CheckoutStepsProps): ReactElement {
  return (
    <nav aria-label="Checkout progress" className="w-full">
      <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 sm:gap-x-4 text-[12px] sm:text-[14px] font-semibold uppercase tracking-wide">
        {CHECKOUT_STEPS.map((step: string, index: number) => {
          const active: boolean = index === current;
          const done: boolean = index < current;
          const isLast: boolean = index === CHECKOUT_STEPS.length - 1;

          const circleClass: string = active
            ? "bg-[#e91e63] text-white"
            : done
              ? "bg-[#212529] text-white"
              : "bg-[#f1f5f9] text-[#6c757d]";

          const labelClass: string = active
            ? "text-[#e91e63]"
            : done
              ? "text-[#212529]"
              : "text-[#6c757d]";

          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-2 sm:gap-4"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold ${circleClass}`}
                >
                  {index + 1}
                </span>
                <span className={labelClass}>{step}</span>
              </span>
              {!isLast && (
                <span aria-hidden="true" className="block w-4 sm:w-8 h-px bg-[#dee2e6]" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
