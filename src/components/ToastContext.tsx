"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

export type ToastType = "success" | "error" | "info" | "warning";

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
      const timer = setTimeout(() => dismissToast(id), 4000);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

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

/* ── Toast container (top-right) ─────────────────────────────────────── */

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
      className="fixed top-4 right-4 z-[200] flex flex-col gap-2 items-end"
      style={{ maxWidth: "min(90vw, 360px)" }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

/* ── Single toast item (white card + colored left status bar) ─────────── */

const STATUS_BAR_COLORS: Record<ToastType, string> = {
  success: "#16a34a",
  error: "#d32f2f",
  warning: "#f59e0b",
  info:    "#2563eb",
};

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  warning: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 9v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const barColor = STATUS_BAR_COLORS[toast.type];

  return (
    <div
      role="status"
      className="flex items-stretch overflow-hidden rounded-lg border border-outline-variant/20 bg-surface shadow-ambient animate-toast-in"
      style={{ minWidth: "240px", maxWidth: "100%" }}
    >
      {/* Colored status bar on left */}
      <div
        className="w-1 shrink-0 rounded-l-lg"
        style={{ background: barColor }}
        aria-hidden="true"
      />

      {/* Icon + message */}
      <div className="flex items-start gap-2.5 px-3 py-3 flex-1">
        <span style={{ color: barColor, flexShrink: 0, marginTop: "1px" }}>
          {ICONS[toast.type]}
        </span>
        <span className="flex-1 text-sm font-medium leading-snug text-on-surface">
          {toast.message}
        </span>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="px-2 opacity-40 hover:opacity-80 transition-opacity shrink-0 flex items-center text-on-surface-variant"
        aria-label="Dismiss notification"
      >
        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
