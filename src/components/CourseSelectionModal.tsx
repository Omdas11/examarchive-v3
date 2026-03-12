"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CLUSTERS,
  IDC_BASKETS,
  AEC_OPTIONS,
  VAC_OPTIONS,
  DSM_ONLY_SUBJECTS,
  LITERATURE_SUBJECTS,
  saveCoursePrefs,
  type CoursePreferences,
} from "@/data/course-selection-data";

interface CourseSelectionModalProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  /** Pre-populate the form with existing preferences for editing. */
  initialPrefs?: CoursePreferences | null;
}

const STEPS = [
  "Cluster",
  "DSC",
  "DSM",
  "IDC",
  "AEC & VAC",
] as const;

type Step = 0 | 1 | 2 | 3 | 4;

const TITLE_ID = "course-selection-title";

export default function CourseSelectionModal({
  open,
  onClose,
  initialPrefs,
}: CourseSelectionModalProps) {
  const [step, setStep] = useState<Step>(0);
  const [cluster, setCluster] = useState(initialPrefs?.cluster ?? "");
  const [dsc, setDsc] = useState(initialPrefs?.dsc ?? "");
  const [dsm1, setDsm1] = useState(initialPrefs?.dsm1 ?? "");
  const [dsm2, setDsm2] = useState(initialPrefs?.dsm2 ?? "");
  const [idcBasket, setIdcBasket] = useState(initialPrefs?.idcBasket ?? "");
  const [idc, setIdc] = useState(initialPrefs?.idc ?? "");
  const [aec, setAec] = useState(initialPrefs?.aec ?? "");
  const [vac, setVac] = useState(initialPrefs?.vac ?? "");

  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset to initial prefs whenever the modal opens
  useEffect(() => {
    if (open) {
      setStep(0);
      setCluster(initialPrefs?.cluster ?? "");
      setDsc(initialPrefs?.dsc ?? "");
      setDsm1(initialPrefs?.dsm1 ?? "");
      setDsm2(initialPrefs?.dsm2 ?? "");
      setIdcBasket(initialPrefs?.idcBasket ?? "");
      setIdc(initialPrefs?.idc ?? "");
      setAec(initialPrefs?.aec ?? "");
      setVac(initialPrefs?.vac ?? "");
    }
  }, [open, initialPrefs]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // ── Derived options ──────────────────────────────────────────────────────

  const clusterSubjects: string[] = cluster ? [...CLUSTERS[cluster]] : [];

  /** Subjects in the cluster that can be selected as DSC (excludes DSM-only). */
  const dscOptions = clusterSubjects.filter(
    (s) => !DSM_ONLY_SUBJECTS.includes(s),
  );

  const dscIsLiterature = LITERATURE_SUBJECTS.includes(dsc);

  /**
   * Subjects that can be chosen as DSM.
   * Filters:
   *  - excludes the chosen DSC (same subject not allowed as both)
   *  - if DSC is a literature, excludes all other literature subjects
   */
  function dsmOptions(exclude: string[]): string[] {
    return clusterSubjects.filter((s) => {
      if (exclude.includes(s)) return false;
      if (dscIsLiterature && LITERATURE_SUBJECTS.includes(s)) return false;
      return true;
    });
  }

  const dsm1Options = dsmOptions(dsc ? [dsc] : []);
  const dsm2Options = dsmOptions([dsc, dsm1].filter(Boolean));

  const idcSubjectOptions = idcBasket
    ? (IDC_BASKETS[idcBasket] as readonly string[]).filter((s) => {
        // Same subject cannot be DSC, DSM, and IDC simultaneously
        const enrolled = [dsc, dsm1, dsm2].filter(Boolean);
        if (enrolled.includes(s)) return false;
        // Literature constraint: if DSC is literature, no other literature as IDC
        if (dscIsLiterature && LITERATURE_SUBJECTS.includes(s)) return false;
        return true;
      })
    : [];

  // ── Validation helpers ───────────────────────────────────────────────────

  function canAdvance(): boolean {
    switch (step) {
      case 0: return cluster !== "";
      case 1: return dsc !== "";
      case 2: return dsm1 !== "" && dsm2 !== "";
      case 3: return idcBasket !== "" && idc !== "";
      case 4: return aec !== "" && vac !== "";
      default: return false;
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleClusterSelect(c: string) {
    setCluster(c);
    // Clear downstream selections when cluster changes
    setDsc("");
    setDsm1("");
    setDsm2("");
  }

  function handleDscSelect(s: string) {
    setDsc(s);
    // Clear DSM selections if they conflict with new DSC
    if (dsm1 === s) setDsm1("");
    if (dsm2 === s) setDsm2("");
    // If new DSC is a literature, clear literature DSMs
    if (LITERATURE_SUBJECTS.includes(s)) {
      if (LITERATURE_SUBJECTS.includes(dsm1)) setDsm1("");
      if (LITERATURE_SUBJECTS.includes(dsm2)) setDsm2("");
    }
  }

  function handleDsm1Select(s: string) {
    setDsm1(s);
    if (dsm2 === s) setDsm2("");
  }

  function handleIdcBasketSelect(b: string) {
    setIdcBasket(b);
    setIdc("");
  }

  function handleSave() {
    const prefs: CoursePreferences = {
      cluster,
      dsc,
      dsm1,
      dsm2,
      idcBasket,
      idc,
      aec,
      vac,
      savedAt: new Date().toISOString(),
    };
    saveCoursePrefs(prefs);
    onClose(true);
  }

  if (!open) return null;

  // ── Step content ─────────────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Both your <strong>DSC</strong> (Discipline Specific Core) and{" "}
              <strong>DSM</strong> (Discipline Specific Minor) subjects must
              come from the same cluster.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.keys(CLUSTERS).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleClusterSelect(c)}
                  className="rounded-lg p-3 text-left text-sm transition-all"
                  style={{
                    border: `2px solid ${cluster === c ? "var(--color-primary)" : "var(--color-border)"}`,
                    background:
                      cluster === c
                        ? "var(--color-accent-soft)"
                        : "var(--color-surface)",
                    color:
                      cluster === c
                        ? "var(--color-primary)"
                        : "var(--color-text)",
                  }}
                >
                  <span className="block font-semibold">{c}</span>
                  <span
                    className="block text-xs mt-1"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {CLUSTERS[c].slice(0, 3).join(", ")}
                    {CLUSTERS[c].length > 3 ? "…" : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Select your <strong>DSC</strong> (Discipline Specific Core)
              subject from <strong>{cluster}</strong>.
            </p>
            <div className="flex flex-wrap gap-2">
              {dscOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleDscSelect(s)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                  style={{
                    border: `1.5px solid ${dsc === s ? "var(--color-primary)" : "var(--color-border)"}`,
                    background:
                      dsc === s
                        ? "var(--color-primary)"
                        : "var(--color-surface)",
                    color: dsc === s ? "#fff" : "var(--color-text)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Select <strong>two DSM</strong> (Discipline Specific Minor)
              subjects from <strong>{cluster}</strong>. They must differ from
              your DSC ({dsc}) and from each other.
            </p>
            {dscIsLiterature && (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "var(--color-accent-soft)",
                  color: "var(--color-primary)",
                  border: "1px solid var(--color-primary)",
                }}
              >
                ℹ️ Since your DSC is a literature subject, other literature
                subjects are excluded from DSM selection.
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                First Minor (DSM 1)
              </p>
              <div className="flex flex-wrap gap-2">
                {dsm1Options.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleDsm1Select(s)}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                    style={{
                      border: `1.5px solid ${dsm1 === s ? "var(--color-primary)" : "var(--color-border)"}`,
                      background:
                        dsm1 === s
                          ? "var(--color-primary)"
                          : "var(--color-surface)",
                      color: dsm1 === s ? "#fff" : "var(--color-text)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                Second Minor (DSM 2)
              </p>
              <div className="flex flex-wrap gap-2">
                {dsm2Options.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={(e) => { e.preventDefault(); setDsm2(s); }}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                    style={{
                      border: `1.5px solid ${dsm2 === s ? "var(--nav-teal)" : "var(--color-border)"}`,
                      background:
                        dsm2 === s ? "var(--nav-teal)" : "var(--color-surface)",
                      color: dsm2 === s ? "#fff" : "var(--color-text)",
                    }}
                  >
                    {s}
                  </button>
                ))}
                {dsm2Options.length === 0 && dsm1 !== "" && (
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    No more subjects available. Choose a different DSM 1.
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Choose an <strong>IDC</strong> (Interdisciplinary Course) basket
              and subject. You cannot select a subject already chosen as DSC or
              DSM.
            </p>
            {dscIsLiterature && (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "var(--color-accent-soft)",
                  color: "var(--color-primary)",
                  border: "1px solid var(--color-primary)",
                }}
              >
                ℹ️ Since your DSC is a literature, other literature subjects are
                excluded from IDC selection.
              </div>
            )}

            {/* Basket selector */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                IDC Basket
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.keys(IDC_BASKETS).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => handleIdcBasketSelect(b)}
                    className="rounded-lg p-2.5 text-left text-sm transition-all"
                    style={{
                      border: `1.5px solid ${idcBasket === b ? "var(--color-primary)" : "var(--color-border)"}`,
                      background:
                        idcBasket === b
                          ? "var(--color-accent-soft)"
                          : "var(--color-surface)",
                      color:
                        idcBasket === b
                          ? "var(--color-primary)"
                          : "var(--color-text)",
                    }}
                  >
                    <span className="font-medium">{b}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject selector */}
            {idcBasket && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                  IDC Subject
                </p>
                {idcSubjectOptions.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    No eligible subjects in this basket (all are already enrolled
                    as DSC/DSM or excluded by literature rule). Choose a
                    different basket.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {idcSubjectOptions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setIdc(s)}
                        className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                        style={{
                          border: `1.5px solid ${idc === s ? "var(--success-green)" : "var(--color-border)"}`,
                          background:
                            idc === s
                              ? "var(--success-green)"
                              : "var(--color-surface)",
                          color: idc === s ? "#fff" : "var(--color-text)",
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold">
                AEC{" "}
                <span
                  className="font-normal text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  (Ability Enhancement Course)
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {AEC_OPTIONS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setAec(o)}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                    style={{
                      border: `1.5px solid ${aec === o ? "var(--color-primary)" : "var(--color-border)"}`,
                      background:
                        aec === o
                          ? "var(--color-primary)"
                          : "var(--color-surface)",
                      color: aec === o ? "#fff" : "var(--color-text)",
                    }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">
                VAC{" "}
                <span
                  className="font-normal text-xs"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  (Value Added Course)
                </span>
              </p>
              <p
                className="mb-2 text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Note: Semester 2 overrides to <strong>EVS</strong> (mandatory).
                Semester 3 onwards: no VAC.
              </p>
              <div className="flex flex-wrap gap-2">
                {VAC_OPTIONS.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setVac(o)}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                    style={{
                      border: `1.5px solid ${vac === o ? "var(--nav-teal)" : "var(--color-border)"}`,
                      background:
                        vac === o ? "var(--nav-teal)" : "var(--color-surface)",
                      color: vac === o ? "#fff" : "var(--color-text)",
                    }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary before saving */}
            <div
              className="rounded-lg p-3 text-xs space-y-1"
              style={{
                background:
                  "color-mix(in srgb, var(--nav-teal) 6%, var(--color-surface))",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="font-semibold text-sm mb-2">Your Course Selection</p>
              {[
                { label: "Cluster", value: cluster },
                { label: "DSC", value: dsc },
                { label: "DSM 1", value: dsm1 },
                { label: "DSM 2", value: dsm2 },
                { label: "IDC", value: `${idc}${idcBasket ? ` (${idcBasket})` : ""}` },
                { label: "AEC", value: aec },
                { label: "VAC", value: vac },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {label}
                  </span>
                  <span className="font-medium">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        );
    }
  }

  return (
    <div
      className="confirm-modal-backdrop"
      aria-hidden="true"
      onClick={() => onClose(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onClick={(e) => e.stopPropagation()}
        className="course-selection-modal"
        style={{
          background: "var(--color-surface)",
          border: "2px solid var(--color-primary)",
          borderRadius: "var(--radius-lg)",
          padding: "1.5rem",
          maxWidth: 560,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2
              id={TITLE_ID}
              className="text-lg font-bold"
              style={{ color: "var(--color-primary)" }}
            >
              Course Selection Setup
            </h2>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="shrink-0 rounded-full p-1 transition-opacity hover:opacity-70"
            aria-label="Close"
            style={{ color: "var(--color-text-muted)" }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-5">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className="flex-1 h-1.5 rounded-full transition-colors"
              style={{
                background:
                  i < step
                    ? "var(--color-primary)"
                    : i === step
                      ? "var(--nav-teal)"
                      : "var(--color-border)",
              }}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Step content */}
        {renderStep()}

        {/* Navigation */}
        <div className="mt-5 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="btn text-sm px-4 py-2"
            >
              ← Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onClose(false)}
              className="btn text-sm px-4 py-2"
            >
              Skip for now
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={!canAdvance()}
              className="btn-primary text-sm px-5 py-2 disabled:opacity-40"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canAdvance()}
              className="btn-primary text-sm px-5 py-2 disabled:opacity-40"
            >
              Save My Courses
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
