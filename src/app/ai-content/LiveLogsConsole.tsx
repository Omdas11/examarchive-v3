"use client";

import { useEffect, useRef } from "react";

type LiveLogsConsoleProps = {
  logs: string[];
};

export default function LiveLogsConsole({ logs }: LiveLogsConsoleProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-4 shadow-lift">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-on-surface">Live Generation Logs</div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {logs.length} entries
        </span>
      </div>
      <div
        ref={containerRef}
        className="h-64 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 font-mono text-xs text-on-surface"
      >
        {logs.length === 0 ? (
          <div className="text-on-surface-variant">No logs yet. Start generation to see live progress updates.</div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className="mb-2 rounded-lg border border-outline-variant/20 bg-surface px-2.5 py-2 whitespace-pre-wrap break-words last:mb-0"
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
