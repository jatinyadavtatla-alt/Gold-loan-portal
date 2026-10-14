import { Landmark } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Compact application header shared by the portal and admin pages.
 * `right` slot holds page-specific actions (e.g. the AI assistant toggle).
 */
export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Aurum Gold Finance — home">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gold-deep text-white">
            <Landmark className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[15px] font-semibold leading-tight">
              Aurum Gold Finance
            </span>
            <span className="block text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
              Gold Loan Portal
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
