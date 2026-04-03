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
    <div className="rounded-xl border border-outline-variant/40 bg-black p-3">
      <div className="mb-2 text-xs font-semibold text-green-300">Live Diagnostic Console</div>
      <div
        ref={containerRef}
        className="h-64 overflow-y-auto rounded-md border border-green-700/40 bg-black p-2 font-mono text-xs text-green-400"
      >
        {logs.length === 0 ? (
          <div className="text-green-500/80">No logs yet. Start generation to see live stream diagnostics.</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="whitespace-pre-wrap break-words">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
