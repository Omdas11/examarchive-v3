"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  showToast: () => {},
  dismissToast: () => {},
});

/** Hook to access the toast system from any client component. */
export function useToast() {
  return useContext(ToastContext);
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    // Clear the auto-dismiss timer if it hasn't fired yet
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = String(++counter);
      setToasts((prev) => [...prev, { id, message, type }]);
      // Auto-dismiss after 4 s; store timer so we can cancel on unmount
      const timer = setTimeout(() => dismissToast(id), 4000);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  // Clear all pending timers when the provider unmounts
  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

/* ── Toast container (bottom-right) ────────────────────────────────────── */

interface ToastContainerProps {
  toasts: Toast[];
  dismiss: (id: string) => void;
}

function ToastContainer({ toasts, dismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 items-end"
      style={{ maxWidth: "min(90vw, 360px)" }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

/* ── Single toast item ─────────────────────────────────────────────────── */

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
};

const COLORS: Record<ToastType, { bg: string; text: string; icon: string }> = {
  success: { bg: "#166534", text: "#dcfce7", icon: "#4ade80" },
  error: { bg: "#991b1b", text: "#fee2e2", icon: "#f87171" },
  info: { bg: "#1e3a5f", text: "#dbeafe", icon: "#60a5fa" },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const c = COLORS[toast.type];

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-lg px-4 py-3 shadow-lg text-sm font-medium animate-toast-in"
      style={{
        background: c.bg,
        color: c.text,
        minWidth: "220px",
        maxWidth: "100%",
      }}
    >
      <span style={{ color: c.icon, flexShrink: 0, marginTop: "1px" }}>
        {ICONS[toast.type]}
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-1 opacity-60 hover:opacity-100 transition-opacity shrink-0"
        aria-label="Dismiss notification"
        style={{ color: c.text }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
