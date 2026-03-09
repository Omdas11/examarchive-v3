"use client";

import { useEffect, useRef } from "react";

/**
 * Hook that fires a confetti burst when `triggerCount` transitions from 0 to 1.
 * This celebrates a user's first successful paper approval.
 */
export function useFirstApprovalConfetti(approvedCount: number) {
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (approvedCount === 1 && !hasFiredRef.current) {
      hasFiredRef.current = true;
      import("canvas-confetti").then((mod) => {
        const confetti = mod.default;
        // Two bursts from left and right
        confetti({
          particleCount: 60,
          spread: 55,
          origin: { x: 0.3, y: 0.6 },
          colors: ["#D3273E", "#003B49", "#2A9D8F", "#F4A261"],
        });
        confetti({
          particleCount: 60,
          spread: 55,
          origin: { x: 0.7, y: 0.6 },
          colors: ["#D3273E", "#003B49", "#2A9D8F", "#F4A261"],
        });
      });
    }
  }, [approvedCount]);
}
