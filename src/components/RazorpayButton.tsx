"use client";

import { useEffect, useRef } from "react";

/**
 * RazorpayButton
 *
 * Renders the embedded Razorpay payment button (payment button id
 * pl_TzM0LNGhNHlx26, linked to https://razorpay.me/@examarchive).
 * The script is injected programmatically on mount (a <script> placed
 * via JSX/innerHTML would not execute), and Razorpay replaces it with
 * the button. Used in the SupportBanner and on /closed.
 */
const RAZORPAY_BUTTON_ID = "pl_TzM0LNGhNHlx26";

export default function RazorpayButton() {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    // Avoid double-injection (React StrictMode double-mount).
    if (form.querySelector("script")) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/payment-button.js";
    script.setAttribute("data-payment_button_id", RAZORPAY_BUTTON_ID);
    script.async = true;
    form.appendChild(script);
  }, []);

  return <form ref={formRef} />;
}
