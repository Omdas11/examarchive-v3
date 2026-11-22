"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Supporter subscription popup — Rs 29/month.
 *
 * Shows once per session (MainLayout gates mounting with a sessionStorage
 * flag). Dismissing it does NOT hide it for the session: the card slides
 * away until only one corner of it peeks out at the bottom-right of the
 * screen, slightly tilted, and tapping that corner reopens the full card.
 * The minimized corner stays visible across client-side navigations because
 * MainLayout (and this component's state) survives them.
 *
 * TODO (subscribe wiring): there is no working Razorpay subscription route
 * on Cloudflare Workers yet — src/app/api/payments/razorpay/* is the old
 * Appwrite-based credit-pack flow and does not run on Workers. Until the
 * subscription create/verify routes exist, "Become a Supporter" goes to
 * /maintenance-cost. Wiring it needs a Rs 29/month Razorpay plan and its
 * plan ID in the RAZORPAY_PLAN_ID_SUPPORTER env var (see
 * getRazorpayPlanId in src/lib/payments.ts) — do not invent a plan ID.
 */

const PERKS: Array<{ icon: string; text: string }> = [
  { icon: "badge", text: "Supporter badge on your profile + name on the supporters wall" },
  { icon: "forum", text: "Ask the team directly — reply within a day" },
  { icon: "auto_awesome", text: "100 AI credits every month" },
  { icon: "picture_as_pdf", text: "2 free AI Notes PDFs a day instead of 1" },
  { icon: "priority_high", text: "Your paper requests jump the queue" },
  { icon: "new_releases", text: "Early access to new papers and features" },
];

interface SupporterPopupProps {
  /** Whether the popup is active this session (MainLayout owns the once-per-session gate). */
  open: boolean;
  /** Guests see the popup too, but the subscribe button sends them to sign in first. */
  isLoggedIn: boolean;
}

export default function SupporterPopup({ open, isLoggedIn }: SupporterPopupProps) {
  // Minimized = only the card's top-left corner peeks out at the bottom-right
  // of the screen, slightly tilted. Tapping that corner reopens the card.
  const [minimized, setMinimized] = useState(false);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <div
        role={minimized ? "button" : "dialog"}
        aria-modal={minimized ? undefined : true}
        aria-label={
          minimized
            ? "Supporter offer — tap to open"
            : "Become a Supporter for Rs 29 a month"
        }
        tabIndex={minimized ? 0 : undefined}
        onClick={minimized ? () => setMinimized(false) : undefined}
        onKeyDown={
          minimized
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setMinimized(false);
                }
              }
            : undefined
        }
        className={
          "pointer-events-auto absolute bottom-4 right-4 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl bg-surface shadow-floating transition-transform duration-300 ease-out " +
          (minimized
            ? "translate-x-[calc(100%_-_72px)] translate-y-[calc(100%_-_60px)] rotate-[4deg] cursor-pointer"
            : "translate-x-0 translate-y-0 rotate-0")
        }
      >
        {/* Header — emerald-to-blue gradient, same family as the reward toast */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-blue-600 px-5 pb-5 pt-5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(true);
            }}
            tabIndex={minimized ? -1 : undefined}
            aria-label="Minimize"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white transition-colors hover:bg-white/20"
          >
            <span
              className="material-symbols-outlined text-[18px] leading-none"
              aria-hidden="true"
            >
              close
            </span>
          </button>
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.25)" }}
            >
              <span
                className="material-symbols-outlined text-[24px] leading-none text-white"
                aria-hidden="true"
              >
                favorite
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight text-white">
                Support ExamArchive
              </p>
              <p
                className="mt-0.5 text-sm font-semibold"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                Supporter — ₹29/month
              </p>
            </div>
          </div>
        </div>

        {/* Perks */}
        <div className="px-5 py-4" aria-hidden={minimized || undefined}>
          <ul className="space-y-2.5">
            {PERKS.map((perk) => (
              <li key={perk.text} className="flex items-start gap-2.5 text-sm text-on-surface">
                <span
                  className="material-symbols-outlined mt-0.5 shrink-0 text-[18px] leading-none text-primary"
                  aria-hidden="true"
                >
                  {perk.icon}
                </span>
                <span>{perk.text}</span>
              </li>
            ))}
          </ul>

          <Link
            href={isLoggedIn ? "/maintenance-cost" : "/login?redirect=/maintenance-cost"}
            tabIndex={minimized ? -1 : undefined}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-600 to-blue-600 px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            <span
              className="material-symbols-outlined text-[18px] leading-none"
              aria-hidden="true"
            >
              favorite
            </span>
            {isLoggedIn ? "Become a Supporter — ₹29/mo" : "Sign in to become a Supporter"}
          </Link>
          {!isLoggedIn && (
            <p className="mt-2 text-center text-xs text-on-surface-variant">
              You need an account to subscribe — signing in is free.
            </p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(true);
            }}
            tabIndex={minimized ? -1 : undefined}
            className="mt-2 w-full rounded-lg py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
