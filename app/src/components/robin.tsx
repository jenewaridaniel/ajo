import type { ReactNode } from "react";
import { Pixels } from "./pixel";
import { ROBIN } from "./bitmaps";

/** The guide's name, in one place so it is easy to change. */
export const MASCOT = "Robin";

export function Robin({ className = "" }: { className?: string }) {
  return <Pixels rows={ROBIN} className={className} title={`${MASCOT}, a pixel squid`} />;
}

/** Robin talking: the squid beside a speech bubble. Stacks on narrow screens. */
const robinSize = { sm: "w-14 sm:w-16", md: "w-20 sm:w-28", lg: "w-20 sm:w-28 lg:w-40" };

export function RobinSays({ children, size = "md" }: { children: ReactNode; size?: keyof typeof robinSize }) {
  return (
    <div className="flex items-end gap-3 sm:gap-4">
      <Robin className={`shrink-0 ${robinSize[size]}`} />
      <div className="relative mb-2 min-w-0 flex-1 border border-violet bg-void px-4 py-3">
        {/* The bubble's tail, a stepped pixel triangle pointing at Robin. */}
        <span aria-hidden className="absolute -left-2 bottom-3 size-2 bg-violet" />
        <span aria-hidden className="absolute -left-1 bottom-4 size-1 bg-violet" />
        <p className="font-display text-xs uppercase tracking-wider text-violet-ink">{MASCOT}</p>
        <div className="mt-1 text-[17px] leading-snug sm:text-lg">{children}</div>
      </div>
    </div>
  );
}
