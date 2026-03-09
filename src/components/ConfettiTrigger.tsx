"use client";

import { useFirstApprovalConfetti } from "@/components/useConfetti";

/**
 * Invisible client component that triggers confetti when the user
 * reaches their first approval (approvedCount === 1).
 */
export default function ConfettiTrigger({ approvedCount }: { approvedCount: number }) {
  useFirstApprovalConfetti(approvedCount);
  return null;
}
