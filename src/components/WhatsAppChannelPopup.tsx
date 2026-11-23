"use client";

/** ExamArchive WhatsApp channel — the one place exam papers and updates go first. */
export const WHATSAPP_CHANNEL_URL =
  "https://whatsapp.com/channel/0029Vb7pK5JEKyZ9443MJR2m";

interface WhatsAppChannelPopupProps {
  /** Whether the popup is currently shown. */
  open: boolean;
  /** The user clicked Join: persist it (server for registered users,
   * localStorage for guests) and close the popup. The link itself opens
   * the channel in a new tab. */
  onJoin: () => void;
  /** The user closed it without joining: hide for this session only.
   * It comes back the next time they open the site, until they join. */
  onDismiss: () => void;
}

/**
 * WhatsApp channel invite popup, shown to every visitor (registered and
 * guest) until they click Join. Uses the site's emerald-to-blue gradient,
 * same as the daily reward toast. No emoji — SVG/material icons only.
 */
export default function WhatsAppChannelPopup({
  open,
  onJoin,
  onDismiss,
}: WhatsAppChannelPopupProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Join our WhatsApp channel"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div className="animate-toast-in relative w-full max-w-sm overflow-hidden rounded-2xl bg-surface shadow-floating">
        <div className="reward-gradient relative px-5 pb-5 pt-6 text-center">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white transition-colors hover:bg-white/20"
          >
            <span
              className="material-symbols-outlined text-[18px] leading-none"
              aria-hidden="true"
            >
              close
            </span>
          </button>
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.25)" }}
          >
            <span
              className="material-symbols-outlined text-[28px] leading-none text-white"
              aria-hidden="true"
            >
              chat
            </span>
          </span>
          <p className="mt-3 text-lg font-bold text-white">
            Join our WhatsApp Channel
          </p>
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
            Exam papers, timetable updates and new uploads — first, free, no
            spam.
          </p>
        </div>
        <div className="px-5 py-4">
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onJoin}
            className="reward-gradient flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white"
          >
            <span
              className="material-symbols-outlined text-[18px] leading-none"
              aria-hidden="true"
            >
              open_in_new
            </span>
            Join WhatsApp Channel
          </a>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-2 w-full rounded-lg py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
