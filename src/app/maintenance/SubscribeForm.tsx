"use client";

import { useState, type FormEvent } from "react";

// Supabase project (uvtqofsjyzwfoifxsnhu) — table maintenance_subscribers.
// The anon key is public by design (it ships in every Supabase client app);
// Row Level Security limits it to INSERT-only on this one table, so it
// cannot read, update, or delete anything. The service_role key is never
// used here. Temporary: this page is removed when maintenance ends.
const SUPABASE_URL = "https://uvtqofsjyzwfoifxsnhu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dHFvZnNqeXp3Zm9pZnhzbmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1OTIwNTcsImV4cCI6MjEwNjE2ODA1N30.PyZto65x9RXpgk4g4KJ6jzKagaOxKbVnSF9xJRkjuIg";

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setState("error");
      setMessage("Please enter a valid email address.");
      return;
    }
    setState("saving");
    setMessage("");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/maintenance_subscribers`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ email: trimmed }),
      });
      if (res.status === 201 || res.status === 200) {
        setState("done");
        return;
      }
      // 409 = duplicate email (unique constraint) — already subscribed.
      if (res.status === 409) {
        setState("done");
        return;
      }
      throw new Error(`Supabase returned ${res.status}`);
    } catch {
      setState("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  if (state === "done") {
    return (
      <div
        className="mt-8 rounded-2xl border p-5 text-center"
        style={{ borderColor: "#047857", backgroundColor: "rgba(4, 120, 87, 0.08)" }}
        role="status"
      >
        <p className="text-lg font-bold" style={{ color: "var(--color-text)" }}>
          You&rsquo;re on the list
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          We will send you one email the moment the site is back.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8" noValidate>
      <div className="flex flex-col gap-3">
        <label htmlFor="maintenance-email" className="sr-only">
          Your email address
        </label>
        <input
          id="maintenance-email"
          type="email"
          autoComplete="email"
          placeholder="Your email address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={state === "saving"}
          className="h-12 w-full rounded-xl border px-4 text-base outline-none"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-text)",
          }}
          required
        />
        <button
          type="submit"
          disabled={state === "saving"}
          className="h-12 w-full rounded-xl px-6 text-base font-bold text-white transition-opacity disabled:opacity-60"
          style={{ backgroundColor: "#047857" }}
        >
          {state === "saving" ? "Saving…" : "Notify me"}
        </button>
      </div>
      <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
        One email when we are back. No spam.
      </p>
      {state === "error" && message && (
        <p className="mt-2 text-sm font-semibold text-red-600" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
