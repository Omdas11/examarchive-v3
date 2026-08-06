"use client";

import { useEffect, useState } from "react";

interface ContributionBannerProps {
  /** Optional custom links if needed */
  whatsappUrl?: string;
  contributeUrl?: string;
}

export default function ContributionBanner({
  whatsappUrl = "https://chat.whatsapp.com/invite/placeholder", // Replace with actual WhatsApp invite link
  contributeUrl = "/support", // Directs to the support page
}: ContributionBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const STORAGE_KEY = "ea_contribution_banner_dismissed";

  useEffect(() => {
    // Check local storage to see if user has already dismissed the banner
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  if (!isVisible) return null;

  return (
    <div className="w-full mt-6 transition-all duration-500 ease-in-out">
      <div
        className="relative overflow-hidden rounded-[2rem] border border-primary/10 p-6 sm:p-8 shadow-md transition-all hover:shadow-lg"
        style={{
          background: "linear-gradient(135deg, var(--brand-emerald-soft) 0%, rgba(16, 185, 129, 0.08) 100%)",
        }}
      >
        {/* Subtle decorative glowing background blob */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--color-primary)" }}
        />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 rounded-full p-2 text-on-surface-variant/70 hover:bg-surface/50 hover:text-on-surface transition-all active:scale-90"
          aria-label="Dismiss banner"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
          {/* Icon Column */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm text-primary transition-transform hover:scale-105 duration-300"
            aria-hidden="true"
          >
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </div>

          {/* Content Column */}
          <div className="flex-1 space-y-2">
            <h2 className="text-xl font-extrabold tracking-tight text-on-surface">
              Support ExamArchive&apos;s Development 🚀
            </h2>
            <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              ExamArchive is a community-driven, student-run platform. If we have helped you, consider supporting us with any contribution (even a tiny amount helps!) to keep the servers running and AI features alive. You can also chat directly with the owner via WhatsApp.
            </p>
          </div>

          {/* Actions Column */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 mt-2 md:mt-0">
            {/* Contribute Link */}
            <a
              href={contributeUrl}
              className="btn-primary text-sm px-6 py-3 rounded-full shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 active:scale-95 text-center font-bold"
            >
              Contribute Support
            </a>

            {/* WhatsApp Link */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-surface text-on-surface border border-outline-variant/20 text-sm px-6 py-3 rounded-full shadow-sm hover:bg-surface-container-low hover:-translate-y-0.5 transition-all duration-300 active:scale-95 font-bold"
            >
              {/* WhatsApp Green Icon */}
              <svg className="h-5 w-5 fill-[#25D366]" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.182 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.59 1.98 14.116.953 11.487.953c-5.447 0-9.875 4.379-9.879 9.809-.002 1.918.52 3.794 1.516 5.504L2.098 21.9l5.709-1.486zM18.11 14.86c-.333-.166-1.968-.969-2.271-1.079-.304-.11-.525-.166-.746.166-.22.332-.855 1.079-1.048 1.301-.194.22-.387.248-.72.083-.332-.165-1.4-.515-2.668-1.643-.986-.879-1.651-1.966-1.845-2.298-.194-.332-.021-.511.145-.676.15-.148.333-.387.5-.581.165-.194.22-.332.332-.553.11-.22.055-.414-.028-.581-.083-.166-.746-1.797-1.021-2.46-.268-.644-.54-.556-.746-.567-.193-.01-.414-.012-.635-.012s-.58.083-.884.414c-.304.331-1.16 1.134-1.16 2.76 0 1.625 1.189 3.197 1.355 3.418.166.22 2.338 3.562 5.665 4.998.791.341 1.41.544 1.892.697.795.252 1.52.216 2.093.13.639-.096 1.968-.801 2.244-1.575.275-.773.275-1.437.193-1.575-.083-.138-.304-.22-.636-.387z" />
              </svg>
              Contact Owner
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
