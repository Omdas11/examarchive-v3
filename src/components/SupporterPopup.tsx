"use client";

import { useState } from "react";
import Link from "next/link";
import { dispatchProfileRefreshEvent } from "@/lib/profile-events";

/**
 * Supporter subscription popup — Rs 29/month.
 *
 * Shows once per session (MainLayout gates mounting with a sessionStorage
 * flag). Dismissing it does NOT hide it for the session: the card slides
 * away until only one corner of it peeks out at the bottom-right of the
 * screen, slightly tilted, and tapping that corner reopens the full card.
 * When open, the card is a centered modal like the WhatsApp popup
 * (bottom-anchored on phones, centered on wider screens, dimmed
 * backdrop) — not a corner card.
 *
 * MainLayout is NOT in the root layout — every page mounts its own
 * MainLayout, so this component remounts on every navigation. The
 * minimized state therefore lives in sessionStorage
 * (ea_supporter_popup_minimized) instead of React state alone: MainLayout
 * passes it back in as `initialMinimized`, so the corner survives
 * navigation and the popup reopens on every page this session.
 *
 * Subscribe flow (signed-in users): loads Razorpay Checkout.js on demand,
 * creates the subscription via POST /api/subscriptions/create, opens
 * Checkout with the subscription id, then verifies the payment via POST
 * /api/subscriptions/verify. On success the popup shows a confirmation,
 * sets localStorage ea_supporter=1 (so MainLayout stops showing it) and
 * refreshes the profile. Guests keep the old behaviour: the button sends
 * them to sign in first.
 */

/** Load https://checkout.razorpay.com/v1/checkout.js once, on demand. */
let checkoutScriptPromise: Promise<void> | null = null;
function loadCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScriptPromise) return checkoutScriptPromise;
  checkoutScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      checkoutScriptPromise = null;
      reject(new Error("Razorpay checkout failed to load. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return checkoutScriptPromise;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const PERKS: Array<{ icon: string; text: string; comingSoon?: boolean }> = [
  { icon: "badge", text: "Supporter badge on your profile + name on the supporters wall" },
  { icon: "forum", text: "Ask the team directly — reply within a day" },
  // Coming soon: not enforced by code yet — shown with a badge, not promised as live.
  { icon: "auto_awesome", text: "100 AI credits every month", comingSoon: true },
  { icon: "picture_as_pdf", text: "2 free AI Notes PDFs a day instead of 1", comingSoon: true },
  { icon: "priority_high", text: "Your paper requests jump the queue" },
  { icon: "new_releases", text: "Early access to new papers and features" },
];

interface SupporterPopupProps {
  /** Whether the popup is active this session (MainLayout owns the once-per-session gate). */
  open: boolean;
  /** Guests see the popup too, but the subscribe button sends them to sign in first. */
  isLoggedIn: boolean;
  /**
   * Start minimized (only the corner peeking out) when the visitor left it
   * minimized on a previous page this session. MainLayout reads this from
   * sessionStorage (ea_supporter_popup_minimized) — the component remounts
   * on every navigation, so React state alone cannot carry it.
   */
  initialMinimized?: boolean;
  /**
   * The WhatsApp channel modal is open at the same time. The card moves to
   * the top-right (above the WhatsApp backdrop, z-101) so both popups stay
   * fully visible and stacked instead of overlapping in the middle.
   * Only applies while the full card is showing, never to the minimized
   * corner (which always peeks out at the bottom-right).
   */
  stacked?: boolean;
}

export default function SupporterPopup({
  open,
  isLoggedIn,
  initialMinimized = false,
  stacked = false,
}: SupporterPopupProps) {
  // Minimized = only the card's top-left corner peeks out at the bottom-right
  // of the screen, slightly tilted. Tapping that corner reopens the card.
  // The minimized state is persisted to sessionStorage so it survives the
  // remount on every navigation (see the header comment).
  const [minimized, setMinimized] = useState(initialMinimized);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Expiry (epoch ms) once the subscription is verified.
  const [subscribedUntil, setSubscribedUntil] = useState<number | null>(null);

  function minimize() {
    setMinimized(true);
    try {
      sessionStorage.setItem("ea_supporter_popup_minimized", "1");
    } catch {
      // storage unavailable; the corner just won't survive navigation
    }
  }

  function reopen() {
    setMinimized(false);
    try {
      sessionStorage.removeItem("ea_supporter_popup_minimized");
    } catch {
      // storage unavailable; nothing to clear
    }
  }

  async function subscribe() {
    setError(null);
    setBusy(true);
    try {
      const createRes = await fetch("/api/subscriptions/create", { method: "POST" });
      const createData = (await createRes.json()) as {
        error?: string;
        keyId?: string;
        subscriptionId?: string;
      };
      if (!createRes.ok) throw new Error(createData.error ?? "Failed to start subscription");
      if (!createData.keyId || !createData.subscriptionId) {
        throw new Error("Subscription could not be started. Please try again.");
      }
      await loadCheckoutScript();
      if (!window.Razorpay) throw new Error("Razorpay checkout failed to load.");

      const checkout = new window.Razorpay({
        key: createData.keyId,
        subscription_id: createData.subscriptionId,
        name: "ExamArchive",
        description: "Supporter — ₹29/month",
        handler: async (response: Record<string, unknown>) => {
          try {
            const verifyRes = await fetch("/api/subscriptions/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = (await verifyRes.json()) as {
              error?: string;
              message?: string;
              expiresAt?: number;
            };
            if (!verifyRes.ok) throw new Error(verifyData.error ?? "Payment verification failed");
            try {
              localStorage.setItem("ea_supporter", "1");
              sessionStorage.removeItem("ea_supporter_popup_minimized");
            } catch {
              // popup hides via state anyway; the flag is a bonus
            }
            dispatchProfileRefreshEvent();
            setSubscribedUntil(
              typeof verifyData.expiresAt === "number" ? verifyData.expiresAt : null,
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "Payment verification failed");
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
        theme: { color: "#047857" },
      });
      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (!open) return null;

  // Layout: when open, the card is a centered modal like the WhatsApp
  // popup (bottom-anchored on phones, centered on wider screens, dimmed
  // backdrop). Dismissing still slides it to the bottom-right corner
  // (minimized). While the WhatsApp modal is open, the full card docks
  // top-right instead so both stay visible and stacked.
  const centered = !minimized && !stacked;

  return (
    <div
      className={
        centered
          ? "fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
          : "pointer-events-none fixed inset-0 overflow-hidden " +
            (stacked ? "z-[101]" : "z-[100]")
      }
    >
      {centered && (
        <div
          className="absolute inset-0 bg-black/50"
          onClick={minimize}
          aria-hidden="true"
        />
      )}
      <div
        role={minimized ? "button" : "dialog"}
        aria-modal={minimized ? undefined : true}
        aria-label={
          minimized
            ? "Supporter offer — tap to open"
            : "Become a Supporter for Rs 29 a month"
        }
        tabIndex={minimized ? 0 : undefined}
        onClick={minimized ? () => reopen() : undefined}
        onKeyDown={
          minimized
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  reopen();
                }
              }
            : undefined
        }
        className={
          "pointer-events-auto max-w-sm overflow-hidden rounded-2xl bg-surface shadow-floating transition-transform duration-300 ease-out " +
          (centered
            ? "animate-toast-in relative w-full "
            : "absolute right-4 w-[calc(100vw-2rem)] ") +
          (minimized
            ? "bottom-4 translate-x-[calc(100%_-_72px)] translate-y-[calc(100%_-_60px)] rotate-[4deg] cursor-pointer"
            : stacked
              ? "top-4 translate-x-0 translate-y-0 rotate-0"
              : "translate-x-0 translate-y-0 rotate-0")
        }
      >
        {/* Header — emerald-to-blue gradient, same family as the reward toast */}
        <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-500 to-blue-600 px-5 pb-5 pt-5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              minimize();
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
                <span>
                  {perk.text}{" "}
                  {perk.comingSoon && (
                    <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                      Coming soon
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {subscribedUntil ? (
            <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-center dark:bg-emerald-950">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
                  check_circle
                </span>
                You are a Supporter now!
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Active until{" "}
                {new Date(subscribedUntil).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                . Thank you for keeping ExamArchive alive.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <p
                  key={error}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    error
                  </span>
                  {error}
                </p>
              )}
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={subscribe}
                  disabled={busy}
                  tabIndex={minimized ? -1 : undefined}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-600 to-blue-600 px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      Opening secure checkout…
                    </>
                  ) : (
                    <>
                      <span
                        className="material-symbols-outlined text-[18px] leading-none"
                        aria-hidden="true"
                      >
                        favorite
                      </span>
                      Become a Supporter — ₹29/mo
                    </>
                  )}
                </button>
              ) : (
                <Link
                  href="/login?redirect=/maintenance-cost"
                  tabIndex={minimized ? -1 : undefined}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-600 to-blue-600 px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                  <span
                    className="material-symbols-outlined text-[18px] leading-none"
                    aria-hidden="true"
                  >
                    favorite
                  </span>
                  Sign in to become a Supporter
                </Link>
              )}
              {!isLoggedIn && (
                <p className="mt-2 text-center text-xs text-on-surface-variant">
                  You need an account to subscribe — signing in is free.
                </p>
              )}
              {isLoggedIn && (
                <p className="mt-2 text-center text-xs text-on-surface-variant">
                  Secured by Razorpay · ₹29/month, cancel anytime
                </p>
              )}
            </>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              minimize();
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
