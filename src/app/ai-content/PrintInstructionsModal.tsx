"use client";

interface PrintInstructionsModalProps {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
}

const TITLE_ID = "print-instructions-title";

export default function PrintInstructionsModal({
  open,
  onClose,
  onProceed,
}: PrintInstructionsModalProps) {
  if (!open) return null;

  return (
    <div className="confirm-modal-backdrop" onClick={onClose} aria-hidden="true">
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={TITLE_ID} className="text-base font-bold" style={{ color: "var(--brand-crimson)" }}>
          Print Instructions
        </h3>
        <p className="mt-2 text-sm whitespace-pre-line" style={{ color: "var(--color-text-muted)" }}>
          To save your notes properly:{"\n"}
          1. Select <strong>Save as PDF</strong> in the destination dropdown.{"\n"}
          2. Set Paper Size to <strong>A4</strong> or <strong>Letter</strong>.{"\n"}
          3. Turn ON <strong>Background graphics</strong> to ensure the ExamArchive watermark is visible.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn text-sm px-4 py-2" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn text-sm px-4 py-2"
            style={{ background: "var(--brand-crimson)", color: "#fff", borderColor: "var(--brand-crimson)" }}
            onClick={onProceed}
          >
            Proceed to Print
          </button>
        </div>
      </div>
    </div>
  );
}
